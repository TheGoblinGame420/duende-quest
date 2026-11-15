// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — lugares con nombre de la franja exterior (v376)
//
// El mundo crecio de 1320 a 1800 m (mmo/js/mundo3d.js: MUNDO, LUGARES3D). Cada lugar se arma aqui con
// piezas de los kits CC0 de Kenney (supervivencia, cementerio y piratas: assets/3d/lugares.*, hecho con
// `node tools/kenney_build.mjs <kits> --lugares`), ajustadas a la escala del duende (1,75 m) y al
// terreno: cada pieza se asienta en su propia altura. Un lugar = una malla fundida (un draw call) que se
// oculta lejos del jugador.
// ═══════════════════════════════════════════════════════
import * as THREE from 'three';

// Escala de cada kit para que cuadre con el duende: tienda ~2,5 m, lapida ~1,2 m, barco ~16 m.
const ESC = { s: 5, g: 2.4, r: 1 };

function rng(sem) { let s = sem >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const hashTxt = t => { let h = 2166136261; for (const c of t) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

// Cada arquitectura devuelve piezas locales { n, x, z, ry, s, y?, rx?, rz?, agua?, solido? } (metros;
// +z = frente del lugar, mirando al pueblo).
const ARQ = {
  panteon(r) {
    const P = [], L = 13;
    for (let i = -L; i < L; i += 2.4) {
      const puerta = Math.abs(i + 1.2) < 1.3;
      P.push({ n: puerta ? 'g_iron-fence-border-gate' : 'g_iron-fence-border', x: i + 1.2, z: L, ry: 0 });
      P.push({ n: r() < 0.25 ? 'g_iron-fence-damaged' : 'g_iron-fence-border', x: i + 1.2, z: -L, ry: Math.PI });
      P.push({ n: 'g_iron-fence-border', x: L, z: i + 1.2, ry: Math.PI / 2 });
      P.push({ n: r() < 0.2 ? 'g_iron-fence-damaged' : 'g_iron-fence-border', x: -L, z: i + 1.2, ry: -Math.PI / 2 });
    }
    for (const [x, z] of [[L, L], [-L, L], [L, -L], [-L, -L]]) P.push({ n: 'g_border-pillar', x, z, s: 1.3 }, { n: 'g_lightpost-single', x: x * 0.86, z: z * 0.86, ry: Math.atan2(-x, -z), solido: 0.3 });
    const lap = ['g_gravestone-round', 'g_gravestone-cross', 'g_gravestone-bevel', 'g_gravestone-decorative', 'g_gravestone-roof', 'g_gravestone-wide', 'g_gravestone-broken', 'g_gravestone-cross-large'];
    for (let fx = -2; fx <= 2; fx++) for (let fz = -1; fz <= 2; fz++) {
      if (fx === 0) continue;   // pasillo central
      const x = fx * 4.2 + (r() - 0.5) * 0.6, z = fz * 4.4 - 1 + (r() - 0.5) * 0.6;
      P.push({ n: lap[Math.floor(r() * lap.length)], x, z: z - 1.2, ry: (r() - 0.5) * 0.25, solido: 0.35 });
      P.push({ n: r() < 0.5 ? 'g_grave' : 'g_grave-border', x, z: z + 0.4 });
      if (r() < 0.3) P.push({ n: r() < 0.5 ? 'g_candle' : 'g_urn-round', x: x + 0.7, z: z - 0.9 });
    }
    P.push({ n: 'g_crypt-large', x: 0, z: -9.5, s: 1.9, solido: 3.6 }, { n: 'g_crypt-large-roof', x: 0, z: -9.5, y: 1.9 * 2.4, s: 1.9 });
    P.push({ n: 'g_candle-multiple', x: -1.6, z: -6, s: 1.2 }, { n: 'g_candle-multiple', x: 1.6, z: -6, s: 1.2 }, { n: 'g_bench', x: -6, z: 10, ry: Math.PI }, { n: 'g_bench-damaged', x: 6, z: 10, ry: Math.PI });
    for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2, d = 17 + r() * 8; P.push({ n: r() < 0.5 ? 'g_pine-crooked' : 'g_pine', x: Math.cos(a) * d, z: Math.sin(a) * d, ry: r() * 6, s: 1.6 + r() * 0.6, solido: 0.5 }); }
    return P;
  },
  cripta(r) {
    const P = [{ n: 'g_crypt-large', x: 0, z: -2, s: 3, solido: 5.5 }, { n: 'g_crypt-large-roof', x: 0, z: -2, y: 3 * 2.4, s: 3 }];
    for (let i = -4; i <= 4; i++) if (Math.abs(i) > 1) P.push({ n: r() < 0.3 ? 'g_stone-wall-damaged' : 'g_stone-wall', x: i * 2.4, z: 11, ry: Math.PI });
    for (let i = -3; i <= 4; i++) { P.push({ n: 'g_stone-wall', x: 10.8, z: i * 2.4 - 1, ry: -Math.PI / 2 }); P.push({ n: r() < 0.3 ? 'g_stone-wall-damaged' : 'g_stone-wall', x: -10.8, z: i * 2.4 - 1, ry: Math.PI / 2 }); }
    for (const x of [-2.6, 2.6]) P.push({ n: 'g_pillar-obelisk', x, z: 9, s: 1.5, solido: 0.5 }, { n: 'g_fire-basket', x: x * 1.6, z: 7, s: 1.4 });
    P.push({ n: 'g_altar-stone', x: 0, z: 5, s: 1.3, solido: 1.2 }, { n: 'g_candle-multiple', x: -0.8, z: 5.3 }, { n: 'g_candle-multiple', x: 0.8, z: 5.3 });
    for (let i = 0; i < 10; i++) { const x = (r() - 0.5) * 18, z = 2 + r() * 7; if (Math.abs(x) < 3) continue; P.push({ n: r() < 0.5 ? 'g_gravestone-broken' : 'g_gravestone-debris', x, z, ry: r() * 6 }); }
    for (const x of [-7, 7]) P.push({ n: 'g_column-large', x, z: -9, s: 1.8, solido: 0.6 });
    return P;
  },
  santuario(r) {
    const P = [];
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; P.push({ n: i % 3 === 2 ? 'g_pillar-square' : 'g_column-large', x: Math.cos(a) * 10, z: Math.sin(a) * 10, s: i % 3 === 2 ? 2.4 : 2.2, solido: 0.6 }); }
    P.push({ n: 'g_altar-stone', x: 0, z: 0, s: 1.6, solido: 1.4 }, { n: 'g_pillar-obelisk', x: 0, z: -4, s: 2.2, solido: 0.6 });
    for (const [x, z] of [[-1.2, 0.8], [1.2, 0.8], [0, -1]]) P.push({ n: 'g_candle-multiple', x, z, y: 1.6 * 0.49 * 2.4 });
    for (let i = 0; i < 6; i++) { const a = r() * 6.28, d = 4 + r() * 4; P.push({ n: r() < 0.5 ? 'g_urn-round' : 'g_urn-square', x: Math.cos(a) * d, z: Math.sin(a) * d }); }
    for (let i = 0; i < 6; i++) { const a = r() * 6.28, d = 14 + r() * 6; P.push({ n: r() < 0.5 ? 'g_rocks-tall' : 'g_rocks', x: Math.cos(a) * d, z: Math.sin(a) * d, ry: r() * 6, s: 2.6, solido: 1 }); }
    return P;
  },
  lenadores(r) {
    const P = [{ n: 's_campfire-pit', x: 0, z: 0, s: 1.2 }, { n: 's_campfire-stand', x: 0, z: 0, s: 1.2 }];
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; P.push({ n: i % 2 ? 's_tent-canvas' : 's_tent', x: Math.cos(a) * 7, z: Math.sin(a) * 7, ry: -a - Math.PI / 2, solido: 1.3 }); P.push({ n: 's_bedroll', x: Math.cos(a) * 3.6, z: Math.sin(a) * 3.6, ry: -a }); }
    for (let k = 0; k < 3; k++) for (let j = 0; j < 3 - k; j++) P.push({ n: 's_tree-log', x: 9 + j * 0.7 + k * 0.35, z: -5, y: k * 0.55, ry: Math.PI / 2, s: 0.75 });
    P.push({ n: 's_workbench', x: -6, z: -4, ry: 0.5, solido: 0.9 }, { n: 's_tool-axe', x: -5.2, z: -2.6, ry: 1 }, { n: 's_resource-planks', x: -8.5, z: -1 }, { n: 's_resource-wood', x: 3.5, z: -7.5 }, { n: 's_resource-wood', x: 4.2, z: -8.2, ry: 1 });
    for (let i = 0; i < 10; i++) { const a = r() * 6.28, d = 12 + r() * 9; P.push({ n: r() < 0.6 ? 's_tree-trunk' : 's_tree-log-small', x: Math.cos(a) * d, z: Math.sin(a) * d, ry: r() * 6, s: 1, solido: 0.45 }); }
    P.push({ n: 's_signpost', x: 3, z: 11, ry: Math.PI }, { n: 's_barrel', x: -3, z: -8 }, { n: 's_box-large', x: -4, z: -8.5, ry: 0.3 }, { n: 's_bucket', x: 1.8, z: 2 });
    return P;
  },
  puesto(r) {
    const P = [];
    for (const [x, z, ry] of [[-5, -4, 0], [5, -4, 0]]) P.push({ n: 's_structure', x, z, ry, s: 1.2, solido: 1.6 }, { n: 's_structure-roof', x, z, y: 3, ry, s: 1.2 });
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; if (Math.abs(Math.sin(a) - 1) < 0.15) continue; P.push({ n: 's_fence-fortified', x: Math.cos(a) * 12, z: Math.sin(a) * 12, ry: -a + Math.PI / 2 }); }
    P.push({ n: 's_campfire-pit', x: 0, z: 3, s: 1.3 }, { n: 's_campfire-fishing-stand', x: 0, z: 3, s: 1.3 }, { n: 's_tent-canvas-half', x: -6, z: 5, ry: 1.2, solido: 1.2 }, { n: 's_tent', x: 6, z: 5, ry: -1.2, solido: 1.2 });
    P.push({ n: 's_workbench-anvil', x: 2.5, z: -0.5, solido: 0.8 }, { n: 's_chest', x: -2.5, z: -0.5 }, { n: 's_box', x: -3.4, z: -0.2 }, { n: 's_box-large-open', x: 3.6, z: 7.5 }, { n: 's_barrel', x: -1, z: 8 }, { n: 's_signpost-single', x: 0, z: 12.5, ry: Math.PI });
    return P;
  },
  mina(r) {
    const P = [{ n: 's_structure-metal', x: 0, z: -6, s: 1.4, solido: 2 }, { n: 's_structure-metal-roof', x: 0, z: -6, y: 3.5, s: 1.4 }];
    for (const x of [-3.6, 3.6]) P.push({ n: 's_metal-panel', x, z: -3, ry: Math.PI / 2 });
    for (let i = 0; i < 6; i++) P.push({ n: 's_floor-old', x: 0, z: -2 + i * 2.4 });
    P.push({ n: 's_tool-pickaxe', x: 2, z: 1, ry: 0.6 }, { n: 's_tool-shovel', x: -2.2, z: 1.5, ry: -0.4 }, { n: 's_bucket', x: 1.5, z: 3 }, { n: 's_box-large', x: -4, z: 4, ry: 0.4 }, { n: 's_box', x: -4.5, z: 5.5 }, { n: 's_workbench-grind', x: 4.5, z: 4, solido: 0.8 });
    for (let i = 0; i < 8; i++) { const a = r() * 6.28, d = 6 + r() * 6; P.push({ n: r() < 0.5 ? 's_resource-stone-large' : 's_resource-stone', x: Math.cos(a) * d, z: Math.sin(a) * d + 2, ry: r() * 6 }); }
    for (const [x, z, n] of [[-9, -8, 'r_rocks-a'], [9, -9, 'r_rocks-b'], [-12, 2, 'r_rocks-c'], [12, 1, 'r_rocks-a']]) P.push({ n, x, z, ry: r() * 6, s: 1.3, solido: 2.6 });
    return P;
  },
  vigia(r) {
    const P = [{ n: 'r_tower-complete-large', x: 0, z: 0, s: 1.3, solido: 2.4 }, { n: 'r_flag-high', x: 0, z: 0, y: 13.3, s: 1.2 }];
    for (let i = -2; i <= 2; i++) if (i) P.push({ n: 'r_castle-wall', x: i * 2.1, z: 6, s: 1, solido: 1 });
    P.push({ n: 'r_castle-gate', x: 0, z: 6.2, solido: 0 }, { n: 'r_barrel', x: -4, z: 3 }, { n: 'r_crate', x: 4, z: 3, ry: 0.4 }, { n: 'r_crate-bottles', x: 4.6, z: 1.6, ry: -0.3 });
    for (let i = 0; i < 7; i++) { const a = r() * 6.28, d = 10 + r() * 8; P.push({ n: ['r_rocks-sand-a', 'r_rocks-sand-b', 'r_rocks-c'][i % 3], x: Math.cos(a) * d, z: Math.sin(a) * d, ry: r() * 6, s: 1.1, solido: 2.2 }); }
    return P;
  },
  atalaya(r) {
    const P = [{ n: 'r_tower-complete-small', x: -3, z: -2, s: 1.4, solido: 2.4 }, { n: 'r_tower-watch', x: 5, z: -1, s: 1.2, solido: 2 }, { n: 'r_flag-high', x: -3, z: -2, y: 9.5, s: 1.1 }];
    P.push({ n: 'r_cannon', x: -1, z: 4, ry: Math.PI, solido: 1 }, { n: 'r_cannon', x: 3, z: 4.5, ry: Math.PI + 0.3, solido: 1 }, { n: 'r_cannon-ball', x: 0.6, z: 3, s: 0.6 }, { n: 'r_cannon-ball', x: 1.1, z: 3.3, s: 0.6 });
    P.push({ n: 'r_barrel', x: -6, z: 2 }, { n: 'r_crate', x: 7, z: 4, ry: 0.5 });
    for (let i = 0; i < 6; i++) { const a = r() * 6.28, d = 11 + r() * 7; P.push({ n: ['r_rocks-a', 'r_rocks-b', 'r_rocks-c'][i % 3], x: Math.cos(a) * d, z: Math.sin(a) * d, ry: r() * 6, s: 1, solido: 2 }); }
    return P;
  },
  naufragio(r) {
    const P = [{ n: 'r_ship-wreck', x: 0, z: -3, ry: 0.7, rz: 0.22, rx: 0.06, y: -1.2, s: 1.3, solido: 5 }];
    P.push({ n: 'r_chest', x: 5, z: 4, ry: 0.6, s: 0.9 }, { n: 'r_cannon-ball', x: 4.2, z: 5.2, s: 0.6 }, { n: 'r_mast', x: -9, z: 3, rz: 1.45, y: 0.8, ry: 0.4, s: 0.9 });
    for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = 6 + r() * 8; P.push({ n: ['r_barrel', 'r_crate', 'r_crate-bottles', 'r_bottle-large'][i % 4], x: Math.cos(a) * d, z: Math.sin(a) * d + 4, ry: r() * 6, rz: (r() - 0.5) * 0.6 }); }
    for (let i = 0; i < 5; i++) { const a = r() * 6.28, d = 13 + r() * 7; P.push({ n: r() < 0.5 ? 'r_palm-detailed-bend' : 'r_palm-detailed-straight', x: Math.cos(a) * d, z: Math.sin(a) * d, ry: r() * 6, s: 2, solido: 0.5 }); }
    return P;
  },
  caleta(r) {
    // +z = tierra adentro; el mar queda hacia -z (lugares.js gira el lugar para que asi sea).
    const P = [];
    for (let i = 0; i < 6; i++) P.push({ n: i === 5 ? 'r_structure-platform-dock-small' : 'r_structure-platform-dock', x: 0, z: 2 - i * 2.5, ry: 0, agua: i > 1, solido: 0 });
    P.push({ n: 'r_ship-pirate-medium', x: 7, z: -14, ry: 1.4, agua: true, y: -1.4, s: 1.5, solido: 5 }, { n: 'r_boat-row-small', x: -3.5, z: -7, ry: 0.3, agua: true, y: -0.4 });
    P.push({ n: 'r_structure', x: -6, z: 8, ry: 0.2, s: 1.4, solido: 1.8 }, { n: 'r_structure-roof', x: -6, z: 8, y: 3.1, ry: 0.2, s: 1.4 }, { n: 'r_flag-pirate-high', x: 3, z: 6, s: 1 }, { n: 'r_cannon', x: 4, z: 3, ry: Math.PI, solido: 1 });
    for (let i = 0; i < 7; i++) P.push({ n: ['r_barrel', 'r_crate', 'r_crate-bottles', 'r_chest'][i % 4], x: -2 + (r() - 0.5) * 8, z: 5 + r() * 5, ry: r() * 6, s: 0.85 });
    for (let i = 0; i < 6; i++) { const a = r() * Math.PI, d = 12 + r() * 6; P.push({ n: r() < 0.5 ? 'r_palm-detailed-bend' : 'r_palm-straight', x: Math.cos(a) * d, z: Math.sin(a) * d, ry: r() * 6, s: 2, solido: 0.5 }); }
    return P;
  },
};

// ── Modelos propios (v392): familia «campamentos» hecha en Blender (tools/blender/modelos/campamentos.py →
// assets/3d/dq_campamentos.*, en el paquete de modelos propios de modelado.js). Cada pieza del kit pasa a un modelo
// propio: [modelo, ajuste, extra]. Ajuste a la caja de la pieza: 'h' escala uniforme por el alto; 'w' uniforme por
// el ancho; 'a' ancho y alto por separado (el fondo escala como el ancho); 'xyz' cada eje; 'caja' cada eje contando
// lo enterrado (el tronco del kit va medio hundido). extra: { c: centrar en la caja de la pieza (las de borde de
// casilla: rejas, muros, empalizada), g: giro extra (rad), k: tinte [r, g, b] }. Mismos sitios y mismas colisiones.
const PROPIO = {
  's_barrel': ['barril', 'h'], 's_bedroll': ['petate', 'h'], 's_box': ['cajon', 'h'], 's_box-large': ['cajon', 'xyz'], 's_box-large-open': ['cajon_abierto', 'xyz'],
  's_bucket': ['cubo', 'h'], 's_campfire-pit': ['hoguera', 'w'], 's_campfire-stand': ['asador', 'h'], 's_campfire-fishing-stand': ['asador', 'h'], 's_chest': ['cofre', 'h'],
  's_fence-fortified': ['empalizada', 'a', { c: 1 }], 's_floor-old': ['tablado', 'xyz'], 's_metal-panel': ['entibado', 'a', { c: 1 }], 's_resource-planks': ['pila_tablas', 'h'],
  's_resource-stone': ['mineral', 'h'], 's_resource-stone-large': ['mineral', 'w'], 's_resource-wood': ['lena', 'h'], 's_signpost': ['letrero', 'h'], 's_signpost-single': ['letrero', 'h'],
  's_structure': ['cobertizo', 'xyz'], 's_structure-roof': ['cobertizo_techo', 'xyz'], 's_structure-metal': ['cobertizo', 'xyz'], 's_structure-metal-roof': ['cobertizo_techo', 'xyz'],
  's_tent': ['tienda', 'h'], 's_tent-canvas': ['tienda', 'h', { k: [0.92, 0.72, 0.62] }], 's_tent-canvas-half': ['tienda_media', 'h'],
  's_tool-axe': ['hacha', 'h'], 's_tool-pickaxe': ['pico', 'h'], 's_tool-shovel': ['pala', 'h'], 's_tree-log': ['tronco', 'caja'], 's_tree-log-small': ['tronco', 'caja'], 's_tree-trunk': ['tocon', 'h'],
  's_workbench': ['banco_trabajo', 'h'], 's_workbench-anvil': ['yunque', 'w'], 's_workbench-grind': ['muela', 'h'],
  'g_altar-stone': ['altar', 'h'], 'g_bench': ['banco_piedra', 'h'], 'g_bench-damaged': ['banco_piedra', 'h', { k: [0.9, 0.9, 0.88] }], 'g_border-pillar': ['pilar_reja', 'h'],
  'g_candle': ['vela', 'h'], 'g_candle-multiple': ['velas', 'h'], 'g_column-large': ['columna', 'h'], 'g_crypt-large': ['cripta', 'a'], 'g_crypt-large-roof': ['cripta_techo', 'xyz'],
  'g_fire-basket': ['brasero', 'w'], 'g_grave': ['tumba', 'xyz', { c: 1 }], 'g_grave-border': ['tumba_borde', 'xyz', { c: 1 }],
  'g_gravestone-round': ['lapida_redonda', 'h'], 'g_gravestone-bevel': ['lapida_redonda', 'h', { k: [0.92, 0.92, 0.9] }], 'g_gravestone-roof': ['lapida_redonda', 'h', { k: [1.06, 1.04, 1.0] }],
  'g_gravestone-decorative': ['lapida_ancha', 'w'], 'g_gravestone-cross': ['lapida_cruz', 'h'], 'g_gravestone-cross-large': ['lapida_cruz', 'h', { k: [0.9, 0.9, 0.9] }],
  'g_gravestone-wide': ['lapida_ancha', 'h'], 'g_gravestone-broken': ['lapida_rota', 'h', { c: 1 }], 'g_gravestone-debris': ['lapida_rota', 'w', { c: 1, g: Math.PI / 2 }],
  'g_iron-fence-border': ['reja', 'a', { c: 1 }], 'g_iron-fence-border-gate': ['reja_puerta', 'a', { c: 1 }], 'g_iron-fence-damaged': ['reja_rota', 'a', { c: 1 }],
  'g_lightpost-single': ['farol_poste', 'h'], 'g_pillar-obelisk': ['obelisco', 'h'], 'g_pillar-square': ['pilar', 'h'], 'g_pine': ['cipres', 'h'], 'g_pine-crooked': ['cipres', 'h', { g: 2.4, k: [0.85, 0.95, 0.8] }],
  'g_rocks': ['risco', 'xyz', { c: 1, g: 1 }], 'g_rocks-tall': ['risco', 'xyz', { c: 1, g: 5 }], 'g_stone-wall': ['muro_piedra', 'a', { c: 1 }], 'g_stone-wall-damaged': ['muro_roto', 'a', { c: 1 }],
  'g_urn-round': ['urna', 'h'], 'g_urn-square': ['urna', 'h', { k: [0.9, 0.9, 0.88] }],
  'r_barrel': ['barril', 'h'], 'r_boat-row-small': ['bote', 'h'], 'r_bottle-large': ['cantaro', 'h'], 'r_cannon': ['bombarda', 'h'], 'r_cannon-ball': ['bala', 'h'],
  'r_castle-gate': ['portal_fuerte', 'xyz'], 'r_castle-wall': ['muro_fuerte', 'xyz'], 'r_chest': ['cofre', 'h'], 'r_crate': ['cajon', 'xyz'], 'r_crate-bottles': ['cajon_abierto', 'xyz'],
  'r_flag-high': ['estandarte', 'h', { c: 1 }], 'r_flag-pirate-high': ['estandarte', 'h', { c: 1, k: [0.42, 0.4, 0.46] }], 'r_mast': ['mastil', 'h'],
  'r_palm-detailed-bend': ['palmera', 'h', { g: Math.PI }], 'r_palm-detailed-straight': ['palmera', 'h', { g: 1.2 }], 'r_palm-straight': ['palmera', 'h', { g: -1.9, k: [1.05, 1.0, 0.92] }],
  'r_rocks-a': ['risco', 'xyz', { c: 1 }], 'r_rocks-b': ['risco', 'xyz', { c: 1, g: 2 }], 'r_rocks-c': ['risco', 'xyz', { c: 1, g: 4 }], 'r_rocks-sand-a': ['risco', 'xyz', { c: 1, k: [1.1, 1.0, 0.85] }], 'r_rocks-sand-b': ['risco', 'xyz', { c: 1, g: 3, k: [1.1, 1.0, 0.85] }],
  'r_ship-pirate-medium': ['barco', 'h'], 'r_ship-wreck': ['pecio', 'h'], 'r_structure': ['cobertizo', 'xyz'], 'r_structure-roof': ['cobertizo_techo', 'xyz'],
  'r_structure-platform-dock': ['muelle', 'xyz'], 'r_structure-platform-dock-small': ['muelle', 'xyz'],
  'r_tower-complete-large': ['torre', 'h'], 'r_tower-complete-small': ['torre_chica', 'h'], 'r_tower-watch': ['atalaya_madera', 'h'],
};
// Caja de cada pieza del kit en sus unidades (min x, y, z, max x, y, z; de assets/3d/lugares.json). Con los modelos
// propios ese paquete ya no se baja: el ajuste y las colisiones salen de estas medidas, las mismas de siempre.
const CAJA_KIT = {
  'g_altar-stone': [-0.52, 0, -0.327, 0.52, 0.488, 0.327], 'g_bench': [-0.404, 0, -0.228, 0.404, 0.526, 0.228], 'g_bench-damaged': [-0.478, 0, -0.228, 0.43, 0.518, 0.228], 'g_border-pillar': [-0.111, 0, -0.111, 0.111, 0.76, 0.111],
  'g_candle': [-0.068, 0, -0.068, 0.068, 0.2, 0.068], 'g_candle-multiple': [-0.125, 0, -0.131, 0.13, 0.2, 0.136], 'g_column-large': [-0.195, 0, -0.195, 0.195, 1.13, 0.195], 'g_crypt-large': [-0.925, 0, -1.2, 0.925, 1, 1.2],
  'g_crypt-large-roof': [-0.988, 0, -1.219, 0.988, 0.759, 1.219], 'g_fire-basket': [-0.208, 0, -0.208, 0.208, 0.168, 0.208], 'g_grave': [-0.382, 0, -0.609, 0.342, 0.114, 0.632], 'g_grave-border': [-0.397, 0, -0.735, 0.364, 0.112, 0.654],
  'g_gravestone-bevel': [-0.225, 0, -0.125, 0.225, 0.529, 0.125], 'g_gravestone-broken': [-0.225, 0, -0.125, 0.284, 0.341, 0.267], 'g_gravestone-cross': [-0.225, 0, -0.165, 0.225, 0.915, 0.165], 'g_gravestone-cross-large': [-0.225, 0, -0.125, 0.225, 0.938, 0.205],
  'g_gravestone-debris': [-0.27, -0.05, -0.517, 0.225, 0.217, 0.125], 'g_gravestone-decorative': [-0.255, 0, -0.125, 0.255, 0.594, 0.125], 'g_gravestone-roof': [-0.243, 0, -0.125, 0.243, 0.608, 0.125], 'g_gravestone-round': [-0.225, 0, -0.125, 0.225, 0.575, 0.125],
  'g_gravestone-wide': [-0.425, 0, -0.15, 0.425, 0.57, 0.15], 'g_iron-fence-border': [-0.5, 0, -0.4, 0.5, 0.879, -0.25], 'g_iron-fence-border-gate': [-0.5, 0, -0.436, 0.5, 0.76, -0.214], 'g_iron-fence-damaged': [-0.5, -0.001, -0.38, 0.5, 0.879, -0.055],
  'g_lightpost-single': [-0.104, 0, -0.102, 0.104, 1.267, 0.363], 'g_pillar-obelisk': [-0.175, 0, -0.175, 0.175, 1.012, 0.175], 'g_pillar-square': [-0.175, 0, -0.175, 0.175, 1.15, 0.175], 'g_pine': [-0.589, -0.1, -0.667, 0.589, 2.202, 0.667],
  'g_pine-crooked': [-0.571, -0.1, -0.667, 0.607, 2.008, 0.667], 'g_rocks': [-0.435, 0, -0.431, 0.641, 0.377, 0.533], 'g_rocks-tall': [-0.51, 0, -0.565, 0.523, 0.588, 0.455], 'g_stone-wall': [-0.5, 0, -0.5, 0.5, 0.725, -0.3],
  'g_stone-wall-damaged': [-0.5, 0, -0.5, 0.5, 0.725, -0.3], 'g_urn-round': [-0.132, 0, -0.132, 0.132, 0.384, 0.132], 'g_urn-square': [-0.132, 0, -0.132, 0.132, 0.384, 0.132], 'r_barrel': [-0.668, 0, -0.668, 0.668, 1.229, 0.668],
  'r_boat-row-small': [-1.374, 0, -1.186, 1.374, 0.848, 1.186], 'r_bottle-large': [-0.233, 0, -0.233, 0.233, 0.89, 0.233], 'r_cannon': [-0.701, 0, -0.934, 0.701, 1.055, 0.991], 'r_cannon-ball': [-0.319, -0.335, -0.276, 0.319, 0.335, 0.276],
  'r_castle-gate': [-2, 0, -1.8, 2, 4.4, 1.8], 'r_castle-wall': [-1, 0, -1.4, 1, 4.4, 1.4], 'r_chest': [-0.637, 0, -0.637, 0.637, 1.147, 0.637], 'r_crate': [-0.539, 0, -0.655, 0.539, 0.77, 0.655],
  'r_crate-bottles': [-0.539, 0, -0.655, 0.539, 1.057, 0.655], 'r_flag-high': [-0.199, 0, -0.199, 1.137, 3.597, 0.199], 'r_flag-pirate-high': [-0.199, 0, -0.199, 1.137, 3.597, 0.199], 'r_mast': [-2.193, 0, -1.179, 2.193, 7.864, 0.561],
  'r_palm-detailed-bend': [-2.174, 0, -1.608, 0.707, 4.251, 1.608], 'r_palm-detailed-straight': [-1.608, 0, -1.608, 1.608, 4.213, 1.608], 'r_palm-straight': [-1.244, 0, -1.244, 1.244, 4.213, 1.244], 'r_rocks-a': [-2.696, 0, -2.253, 2.417, 2.898, 2.133],
  'r_rocks-b': [-2.389, 0, -2.491, 2.048, 3.654, 2.213], 'r_rocks-c': [-1.624, 0, -1.881, 2.018, 2.3, 1.788], 'r_rocks-sand-a': [-2.696, 0, -2.253, 2.417, 3.212, 2.133], 'r_rocks-sand-b': [-2.342, 0, -2.467, 2.037, 3.714, 2.243],
  'r_ship-pirate-medium': [-2.4, 0, -5.3, 2.4, 9.964, 5.3], 'r_ship-wreck': [-2.4, 0, -5.3, 2.4, 9.964, 5.3], 'r_structure': [-1.25, 0, -1.25, 1.25, 2.2, 1.25], 'r_structure-platform-dock': [-1.25, 0, -1.256, 1.25, 1.312, 1.256],
  'r_structure-platform-dock-small': [-0.95, 0, -1.256, 0.95, 1.312, 1.256], 'r_structure-roof': [-1.544, 0, -1.617, 1.541, 3.4, 1.617], 'r_tower-complete-large': [-1.814, 0, -1.814, 1.814, 10.225, 1.814], 'r_tower-complete-small': [-1.677, 0, -1.677, 1.677, 6.785, 1.98],
  'r_tower-watch': [-1.524, 0, -1.524, 1.524, 2.785, 1.524], 's_barrel': [-0.118, 0, -0.118, 0.118, 0.344, 0.118], 's_bedroll': [-0.155, -0.05, -0.304, 0.155, 0.075, 0.304], 's_box': [-0.125, 0, -0.125, 0.125, 0.25, 0.125],
  's_box-large': [-0.125, 0, -0.25, 0.125, 0.25, 0.25], 's_box-large-open': [-0.125, 0, -0.25, 0.125, 0.306, 0.25], 's_bucket': [-0.072, 0, -0.072, 0.072, 0.192, 0.072], 's_campfire-fishing-stand': [-0.197, 0, -0.127, 0.197, 0.276, 0.127],
  's_campfire-pit': [-0.139, 0, -0.135, 0.139, 0.109, 0.135], 's_campfire-stand': [-0.205, 0, -0.062, 0.205, 0.281, 0.062], 's_chest': [-0.13, 0, -0.142, 0.13, 0.257, 0.13], 's_fence-fortified': [-0.25, 0, -0.25, 0.25, 0.517, -0.197],
  's_floor-old': [-0.255, 0, -0.247, 0.245, 0.051, 0.253], 's_metal-panel': [-0.25, 0, -0.025, 0.25, 0.5, 0.025], 's_resource-planks': [-0.186, 0, -0.313, 0.186, 0.094, 0.313], 's_resource-stone': [-0.083, 0, -0.071, 0.083, 0.107, 0.071],
  's_resource-stone-large': [-0.188, 0, -0.168, 0.188, 0.16, 0.168], 's_resource-wood': [-0.103, 0, -0.044, 0.103, 0.062, 0.044], 's_signpost': [-0.112, 0, -0.018, 0.102, 0.46, 0.025], 's_signpost-single': [-0.112, 0, -0.018, 0.096, 0.46, 0.025],
  's_structure': [-0.25, 0, -0.25, 0.25, 0.5, 0.25], 's_structure-metal': [-0.268, 0, -0.268, 0.268, 0.5, 0.268], 's_structure-metal-roof': [-0.27, 0, -0.275, 0.274, 0.5, 0.275], 's_structure-roof': [-0.272, 0, -0.276, 0.263, 0.657, 0.276],
  's_tent': [-0.28, 0, -0.275, 0.28, 0.491, 0.286], 's_tent-canvas': [-0.28, 0, -0.275, 0.28, 0.491, 0.286], 's_tent-canvas-half': [-0.28, 0, -0.275, 0.28, 0.491, 0.286], 's_tool-axe': [-0.073, 0, -0.015, 0.041, 0.256, 0.015],
  's_tool-pickaxe': [-0.089, 0, -0.019, 0.089, 0.24, 0.019], 's_tool-shovel': [-0.035, 0, -0.015, 0.035, 0.29, 0.015], 's_tree-log': [-0.122, -0.106, -0.5, 0.127, 0.171, 0.5], 's_tree-log-small': [-0.125, 0, -0.325, 0.125, 0.277, 0.325],
  's_tree-trunk': [-0.1, 0, -0.1, 0.1, 0.261, 0.1], 's_workbench': [-0.148, 0, -0.148, 0.178, 0.287, 0.148], 's_workbench-anvil': [-0.148, 0, -0.148, 0.175, 0.336, 0.148], 's_workbench-grind': [-0.13, 0, -0.165, 0.13, 0.282, 0.165],
};

// Modelos propios que faltan en el paquete (PAQ de modelado.js). Vacio = los lugares se arman sin el kit.
export function faltanPropios(PAQ) {
  if (!PAQ || !PAQ.modelos) return ['(sin paquete)'];
  return [...new Set(Object.values(PROPIO).map(v => v[0]))].filter(n => !PAQ.modelos[n]);
}

// Ajuste de cada pieza del kit a su modelo propio (matriz local: giro extra, escala a la caja y centrado). Una vez.
const _aj = new Map();
function ajuste(PAQ, n) {
  if (_aj.has(n)) return _aj.get(n);
  const [mod, modo, x = {}] = PROPIO[n], k = CAJA_KIT[n], e = ESC[n[0]] || 1, cj = PAQ.caja(mod);
  const g = x.g || 0, gira = Math.abs(Math.sin(g)) > 0.5;
  // Caja del modelo ya girado (solo importan los giros de cuarto de vuelta para el ancho y el fondo).
  const mW = (gira ? cj.max[2] - cj.min[2] : cj.max[0] - cj.min[0]) || 1, mD = (gira ? cj.max[0] - cj.min[0] : cj.max[2] - cj.min[2]) || 1, mH = cj.max[1] || 1;
  const kW = (k[3] - k[0]) * e, kD = (k[5] - k[2]) * e, kH = k[4] * e;
  let fx, fy, fz, ty = 0;
  if (modo === 'w') fx = fy = fz = Math.max(kW, kD) / Math.max(mW, mD);
  else if (modo === 'a') { fx = fz = kW / mW; fy = kH / mH; }
  else if (modo === 'xyz' || modo === 'caja') { fx = kW / mW; fz = kD / mD; fy = kH / mH; if (modo === 'caja') { fy = (k[4] - k[1]) * e / ((cj.max[1] - cj.min[1]) || 1); ty = k[1] * e - cj.min[1] * fy; } }
  else fx = fy = fz = kH / mH;
  const M = new THREE.Matrix4().makeRotationY(g).premultiply(new THREE.Matrix4().makeScale(fx, fy, fz));
  if (x.c) {   // el centro (x, z) del modelo girado y escalado, al centro de la caja de la pieza
    const c = new THREE.Vector3((cj.min[0] + cj.max[0]) / 2, 0, (cj.min[2] + cj.max[2]) / 2).applyMatrix4(M);
    M.premultiply(new THREE.Matrix4().makeTranslation((k[0] + k[3]) / 2 * e - c.x, ty, (k[2] + k[5]) / 2 * e - c.z));
  } else if (ty) M.premultiply(new THREE.Matrix4().makeTranslation(0, ty, 0));
  const r = { mod, M, k: x.k || null };
  _aj.set(n, r);
  return r;
}

// Junta las piezas de un lugar (ya colocadas como las del kit: {n, x, y, z, rx, ry, rz, s} con s en unidades del kit)
// en UNA geometria del nivel de detalle `lod`, con normales (sombreado suave del material de modelado.js).
const _m = new THREE.Matrix4(), _mp = new THREE.Matrix4(), _nm = new THREE.Matrix3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Vector3();
const SIN_AJUSTE = new THREE.Matrix4();
function fundirPropio(PAQ, piezas, lod) {
  // p.m: un modelo propio por su nombre, a su tamaño real por p.s (vivacs de los campamentos); p.n: una pieza del kit.
  const ls = piezas.map(p => { const a = p.m ? { mod: p.m, M: SIN_AJUSTE, k: p.k || null } : ajuste(PAQ, p.n); return { p, a, g: PAQ.geo(a.mod, lod) }; });
  let nv = 0, ni = 0;
  for (const { g } of ls) { nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Int8Array(nv * 3), col = new Float32Array(nv * 3), tin = new Float32Array(nv), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let ov = 0, oi = 0;
  for (const { p, a, g } of ls) {
    const P = g.attributes.position.array, N = g.attributes.normal.array, C = g.attributes.color.array, T = g.attributes.tinte.array, I = g.index.array, n = P.length / 3;
    // p.s de una pieza del kit viene en sus unidades (ESC · s del lugar); el ajuste ya pasa el modelo a metros de la pieza a escala ESC.
    const sc = p.m ? p.s : p.s / (ESC[p.n[0]] || 1);
    _e.set(p.rx || 0, p.ry || 0, p.rz || 0); _q.setFromEuler(_e); _v.set(p.x, p.y, p.z); _s.set(sc, sc, sc);
    _mp.compose(_v, _q, _s); _m.multiplyMatrices(_mp, a.M); _nm.getNormalMatrix(_m);
    const k = a.k, e = _m.elements;
    for (let i = 0; i < n; i++) {
      const j = i * 3, b = (ov + i) * 3, x = P[j], y = P[j + 1], z = P[j + 2];
      pos[b] = e[0] * x + e[4] * y + e[8] * z + e[12]; pos[b + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; pos[b + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      _n.set(N[j], N[j + 1], N[j + 2]).applyMatrix3(_nm).normalize();
      nor[b] = Math.round(_n.x * 127); nor[b + 1] = Math.round(_n.y * 127); nor[b + 2] = Math.round(_n.z * 127);
      const kk = k && T[i] !== 7;
      col[b] = C[j] * (kk ? k[0] : 1); col[b + 1] = C[j + 1] * (kk ? k[1] : 1); col[b + 2] = C[j + 2] * (kk ? k[2] : 1);
      tin[ov + i] = T[i];
    }
    if (_m.determinant() < 0) for (let i = 0; i < I.length; i += 3) { idx[oi + i] = I[i] + ov; idx[oi + i + 1] = I[i + 2] + ov; idx[oi + i + 2] = I[i + 1] + ov; }
    else for (let i = 0; i < I.length; i++) idx[oi + i] = I[i] + ov;
    ov += n; oi += I.length;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3, true));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('tinte', new THREE.BufferAttribute(tin, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

// ── Vivacs de los campamentos de la franja exterior (v392) ──
// Los 31 campamentos de monstruos fuertes de la franja (mmo/js/mundo3d.js, camposExteriores) eran solo un claro. Al
// borde de cada uno, del lado de fuera, queda el vivac de quienes acampan alli: hoguera, una o dos tiendas, estandarte,
// pertrechos y un trozo de empalizada. Solo dibujo y colisiones del cliente (como los lugares); los monstruos, sus
// puntos de aparicion y el servidor no cambian. Nada a menos de 6 m de un punto de recoleccion o un cofre, ni a 30 m
// de un lugar con nombre, ni encima de un arbol o una roca (o.ocupado), ni en el agua o en una ladera.
function vivac(c, o) {
  const r = rng(7919 + c.id * 104729), out = [];
  const a0 = Math.atan2(c.z, c.x) + (r() - 0.5) * 0.9;   // hacia fuera del centro del mundo
  const y0 = o.alturaEn(c.x, c.z);
  const pon = (m, rad, a, s, opc = {}) => {
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad, wx = c.x + x, wz = c.z + z, h = o.alturaEn(wx, wz), radio = opc.radio || 1;
    if (h < o.agua + 0.4 || o.pendienteEn(wx, wz) > 0.5) return false;
    if (o.lugares.some(L => Math.hypot(L.x - wx, L.z - wz) < 30)) return false;
    if ((o.evitar || []).some(p => Math.abs(p.x - wx) < 8 && Math.abs(p.z - wz) < 8 && Math.hypot(p.x - wx, p.z - wz) < 5 + radio)) return false;
    if (o.ocupado && o.ocupado(wx, wz, radio)) return false;
    out.push({ m, x, y: h - y0 - 0.05, z, ry: opc.ry !== undefined ? opc.ry : Math.atan2(-x, -z), s, k: opc.k || null, solido: opc.solido || 0, wx, wz, tan: opc.tan || 0 });
    return true;
  };
  if (!pon('hoguera', 10, a0, 1, { radio: 0.8 })) return null;
  pon('tronco', 8.4, a0 + 0.14, 0.34, { ry: -a0 - 0.14, radio: 0.9 });
  pon('lena', 10.9, a0 - 0.16, 1, { radio: 0.6 });
  pon('tienda', 12.2, a0 + 0.42, 0.85, { radio: 1.4, solido: 1.15, k: r() < 0.5 ? [0.92, 0.72, 0.62] : null });
  if (r() < 0.65) pon(r() < 0.5 ? 'tienda_media' : 'tienda', 12.4, a0 - 0.46, 0.85, { radio: 1.4, solido: 1.1 });
  pon('estandarte', 9.4, a0 - 0.95, 0.9, { radio: 0.5, k: r() < 0.5 ? [0.42, 0.4, 0.46] : null });
  if (!o.ligero) {
    pon('barril', 11.6, a0 + 0.96, 0.6, { radio: 0.5 });
    pon('cajon', 12.5, a0 + 1.06, 0.55, { radio: 0.6, ry: r() * 6.28 });
  }
  for (const d of [-0.17, 0, 0.17]) pon('empalizada', 15.2, a0 + d, 0.85, { radio: 1.3, ry: -(a0 + d) - Math.PI / 2, tan: 1, solido: 1 });
  return out.length >= 4 ? { y0, piezas: out } : null;
}

// opts: { escena, KIT (paquete 'lugares') o PAQ (modelos propios; manda si llega), lugares (LUGARES3D), alturaEn, agua, ponerSolido, sombras, ligero,
//         y para los vivacs (solo con PAQ): campos (campamentos exteriores), pendienteEn, evitar (nodos y cofres), ocupado(x, z, r) }
export function construirLugares(o) {
  const hechos = [], propio = !!o.PAQ;
  for (const L of o.lugares) {
    const arq = ARQ[L.estilo]; if (!arq) continue;
    const r = rng(hashTxt(L.id));
    let ry = L.ry;
    if (L.estilo === 'caleta') {   // que el muelle apunte al agua: la direccion mas baja a 25 m
      let mejor = ry, hMin = Infinity;
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, h = o.alturaEn(L.x + Math.sin(a) * 25, L.z + Math.cos(a) * 25); if (h < hMin) { hMin = h; mejor = a; } }
      ry = mejor + Math.PI;   // -z local = hacia el mar
    }
    const cs = Math.cos(ry), sn = Math.sin(ry), y0 = o.alturaEn(L.x, L.z);
    const piezas = [];
    for (const p of arq(r)) {
      if (o.ligero && p.n && /candle|urn|bottle|cannon-ball|bucket|resource-stone$|tool-/.test(p.n) ) continue;
      const kit = p.n[0], s = (ESC[kit] || 1) * (p.s || 1);
      const wx = L.x + p.x * cs + p.z * sn, wz = L.z - p.x * sn + p.z * cs;
      const suelo = p.agua ? Math.max(o.agua - 0.2, o.alturaEn(wx, wz)) : o.alturaEn(wx, wz);
      piezas.push({ n: p.n, x: p.x, z: p.z, y: suelo - y0 + (p.y || 0) - 0.05, rx: p.rx || 0, ry: p.ry || 0, rz: p.rz || 0, s });
      if (p.solido) o.ponerSolido(wx, wz, p.solido);
      else if (p.solido === undefined && !p.agua && s * (propio ? (CAJA_KIT[p.n] || [0, 0, 0, 0, 0])[4] : ((o.KIT.ind[p.n] || {}).max || [0, 0])[1]) > 1.2) o.ponerSolido(wx, wz, 0.5);
    }
    if (propio) {   // se arma cuando el jugador se acerca (visibilidad): de lejos no ocupa memoria ni tiempo de carga
      hechos.push({ L, m: null, piezas: piezas.filter(p => PROPIO[p.n]), y0, ry });
      continue;
    }
    let m;
    try { m = new THREE.Mesh(o.KIT.fundir(piezas.filter(p => o.KIT.ind[p.n])), o.KIT.material); } catch (e) { console.warn('[3D] lugar', L.id, e); continue; }
    m.position.set(L.x, y0, L.z); m.rotation.y = ry;
    m.matrixAutoUpdate = false; m.updateMatrix();
    if (o.sombras) { m.castShadow = true; m.receiveShadow = true; }
    o.escena.add(m);
    hechos.push({ L, m });
  }
  if (propio && o.campos && o.pendienteEn) for (const c of o.campos) {
    let v = null;
    try { v = vivac(c, o); } catch (e) { console.warn('[3D] vivac', c.id, e); }
    if (!v) continue;
    for (const p of v.piezas) {
      if (!p.solido) continue;
      if (p.tan) {   // tramo de empalizada: tres circulos a lo largo
        const a = -p.ry - Math.PI / 2, tx = -Math.sin(a), tz = Math.cos(a);
        for (const d of [-0.8, 0, 0.8]) o.ponerSolido(p.wx + tx * d, p.wz + tz * d, 0.55);
      } else o.ponerSolido(p.wx, p.wz, p.solido);
    }
    hechos.push({ L: { id: 'campo' + c.id, x: c.x, z: c.z }, m: null, piezas: v.piezas, y0: v.y0, ry: 0 });
  }
  // Un lugar propio: sus piezas fundidas en una malla por nivel de detalle, dentro de un THREE.LOD (el motor elige el
  // nivel con la camara). En calidad baja y minima, solo los niveles medio y bajo.
  const baja = !!o.ligero;
  function armar(h) {
    const lod = new THREE.LOD();
    lod.position.set(h.L.x, h.y0, h.L.z); lod.rotation.y = h.ry;
    for (const [nv, d] of baja ? [[1, 0], [2, 70]] : [[0, 0], [1, 60], [2, 130]]) {
      const m = new THREE.Mesh(fundirPropio(o.PAQ, h.piezas, nv), o.PAQ.material);
      if (o.sombras) { m.castShadow = nv < 2; m.receiveShadow = true; }
      m.matrixAutoUpdate = false; m.updateMatrix();
      lod.addLevel(m, d, 0.08);
    }
    lod.matrixAutoUpdate = false; lod.updateMatrix();
    o.escena.add(lod); lod.updateMatrixWorld(true);
    h.m = lod; h.piezas = null;
  }
  return {
    lista: hechos,
    // Lejos (mas alla de la niebla) no se dibuja. Los propios se arman al entrar en ese radio (uno por llamada).
    visibilidad(px, pz, lejos) {
      let hecho = false;
      for (const h of hechos) {
        const cerca = Math.hypot(h.L.x - px, h.L.z - pz) < lejos + 80;
        if (!h.m) {
          if (!cerca || hecho) continue;
          try { armar(h); } catch (e) { console.warn('[3D] lugar', h.L.id, e); h.m = new THREE.Group(); }
          hecho = true;
        }
        h.m.visible = cerca;
      }
    },
  };
}
