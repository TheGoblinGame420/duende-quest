// Sprites 2D del decorado para CLASSIC (mmo/js/fondo2d.js): Blender sin ventana -> PNG -> atlas webp.
//   node tools/blender/sprites2d_deco.mjs [atlas ...]       (sin nombres: todos)
// Salida: assets/2d/<atlas>.webp + .json (los PNG intermedios van a una carpeta temporal).
// Las casas siguen saliendo de sprites2d.mjs (assets/2d/casas2d.*).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.resolve(AQUI, '../..');
const BLENDER = process.env.BLENDER || 'C:/Program Files/Blender Foundation/Blender 5.3/blender.exe';
// atlas -> [familia, modelos, px por metro, alto maximo]
const ATLAS = {
  arboles2d: [['arboles', 'roble_a,roble_b,abedul_a,abeto_a,abeto_b,nevado_a,nevado_b,muerto_a,muerto_b,selva_a,selva_b', 18, 280]],
  rocas2d: [['rocas', 'roca_penasco,roca_cantos,roca_aguja,roca_monton,arenisca_losa,arenisca_aguja,nevada_penasco,nevada_aguja,pizarra_lajas,pizarra_penasco,basalto_columnas,basalto_penasco', 21, 160]],
  ruinas2d: [['ruinas', 'menhir_a,menhir_b,menhir_c,murete_a,murete_b,murete_c', 14, 120], ['rocas', 'menhir_runas,columna_rota,obelisco_viejo', 14, 120]],
  objetos2d: [['objetos', 'fuente,farol,puesto,barril,cajon,valla,carro,pozo', 18, 120]],
};
const pedidos = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ATLAS);
fs.mkdirSync(path.join(RAIZ, 'assets/2d'), { recursive: true });
for (const nom of pedidos) {
  if (!ATLAS[nom]) throw new Error('no hay atlas ' + nom + ' (hay: ' + Object.keys(ATLAS).join(', ') + ')');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dq_' + nom + '_')), dirs = [];
  ATLAS[nom].forEach(([fam, lista, pxm, alto], i) => {
    const d = path.join(tmp, String(i)); dirs.push(d);
    execFileSync(BLENDER, ['--background', '--factory-startup', '--python', path.join(AQUI, 'sprites2d_deco.py'), '--', fam, lista, d, String(pxm), String(alto)], { stdio: ['ignore', 'inherit', 'inherit'] });
  });
  execFileSync('python', [path.join(AQUI, 'sprites2d_deco_atlas.py'), path.join(RAIZ, 'assets/2d', nom), ...dirs], { stdio: 'inherit' });
  fs.rmSync(tmp, { recursive: true, force: true });
}
