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

// opts: { escena, KIT (paquete 'lugares'), lugares (LUGARES3D), alturaEn, agua, ponerSolido, sombras, ligero }
export function construirLugares(o) {
  const hechos = [];
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
      else if (p.solido === undefined && !p.agua && s * ((o.KIT.ind[p.n] || {}).max || [0, 0])[1] > 1.2) o.ponerSolido(wx, wz, 0.5);
    }
    let m;
    try { m = new THREE.Mesh(o.KIT.fundir(piezas.filter(p => o.KIT.ind[p.n])), o.KIT.material); } catch (e) { console.warn('[3D] lugar', L.id, e); continue; }
    m.position.set(L.x, y0, L.z); m.rotation.y = ry;
    m.matrixAutoUpdate = false; m.updateMatrix();
    if (o.sombras) { m.castShadow = true; m.receiveShadow = true; }
    o.escena.add(m);
    hechos.push({ L, m });
  }
  return {
    lista: hechos,
    // Lejos (mas alla de la niebla) no se dibuja.
    visibilidad(px, pz, lejos) { for (const h of hechos) h.m.visible = Math.hypot(h.L.x - px, h.L.z - pz) < lejos + 80; },
  };
}
