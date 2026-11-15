// Sprites 2D de los edificios para CLASSIC (mmo/js/fondo2d.js): Blender sin ventana -> PNG -> atlas webp.
//   node tools/blender/sprites2d.mjs [px_por_metro=13] [alto_max=200]
// Salida: assets/2d/casas2d.webp + assets/2d/casas2d.json (los PNG intermedios van a una carpeta temporal).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.resolve(AQUI, '../..');
const BLENDER = process.env.BLENDER || 'C:/Program Files/Blender Foundation/Blender 5.3/blender.exe';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dq_sprites2d_'));
const args = process.argv.slice(2);
execFileSync(BLENDER, ['--background', '--factory-startup', '--python', path.join(AQUI, 'sprites2d.py'), '--', tmp, ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
fs.mkdirSync(path.join(RAIZ, 'assets/2d'), { recursive: true });
execFileSync('python', [path.join(AQUI, 'sprites2d_atlas.py'), tmp, path.join(RAIZ, 'assets/2d/casas2d')], { stdio: 'inherit' });
fs.rmSync(tmp, { recursive: true, force: true });
