// ═══════════════════════════════════════════════════════
// Video promocional de DUENDE QUEST, de principio a fin, con UN comando:
//
//   node tools/promo/hacer_promo.mjs                 (graba todo y monta)
//   node tools/promo/hacer_promo.mjs --solo-montar   (reusa las tomas grabadas)
//   node tools/promo/hacer_promo.mjs mazmorra,online (regraba esas y monta)
//
// 1) grabar.mjs: tomas reales del MMO y del arcade (Chrome sin ventana +
//    servidor local propio en :8796; no toca el :8787 ni producción).
// 2) montar.py: música original (musica.py), rótulos, cortes, SFX CC0 y
//    exportación. Salida en promo/ (fuera de git y del sitio publicado):
//    duende_quest_promo_30s.mp4, duende_quest_promo_30s_cuadrado.mp4, portada.png
// Requisitos: Node 22+, Chrome o Edge, ffmpeg en el PATH, Python con Pillow y numpy.
// Tarda ~10 min (la grabación es en tiempo real). Los cortes (segundo de cada
// toma) y los textos están al principio de montar.py.
// ═══════════════════════════════════════════════════════
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const correr = (cmd, a) => {
  const r = spawnSync(cmd, a, { stdio: 'inherit' });
  if (r.status !== 0) { console.error(`[promo] falló: ${cmd} ${a.join(' ')}`); process.exit(r.status || 1); }
};
if (!args.includes('--solo-montar')) correr(process.execPath, [path.join(AQUI, 'grabar.mjs'), ...args.filter(a => !a.startsWith('--'))]);
correr(process.platform === 'win32' ? 'python' : 'python3', [path.join(AQUI, 'montar.py')]);
console.log('[promo] listo: promo/duende_quest_promo_30s.mp4, promo/duende_quest_promo_30s_cuadrado.mp4, promo/portada.png');
