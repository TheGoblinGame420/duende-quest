// ═══════════════════════════════════════════════════════
// Publicar sin perder progreso de nadie:
//  1. node tools/verificar.mjs (sintaxis, mismo ?v=, metodos, mensajes, arnes).
//  2. Pregunta al servidor cuantos hay conectados (/api/mantenimiento {solo:1}).
//     Entre las 12:00 y las 24:00 de Lima con mas de 15 conectados NO publica,
//     salvo --forzar (mejor a la madrugada).
//  3. git push (Cloudflare despliega solo).
//  4. /api/mantenimiento: el servidor guarda a todos, les avisa y cierra con 1012;
//     durante 3 min nadie entra (reintentan solos) y vuelven ya con la version
//     nueva. Al arrancar, el servidor hace una copia de todo (version nueva).
//
//   DEPLOY_SECRET=... node tools/deploy.mjs [--forzar] [--sin-arnes]
//
// DEPLOY_SECRET: el mismo secreto (16+ caracteres) puesto en Cloudflare con
//   npx wrangler secret put DEPLOY_SECRET
// Sin el, se salta la consulta y el guardado previo (como publicar a mano).
// DQ_URL: por defecto produccion.
// ═══════════════════════════════════════════════════════
import { spawnSync } from 'node:child_process';
import { RAIZ } from './version.mjs';

const args = new Set(process.argv.slice(2));
const URL_BASE = (process.env.DQ_URL || 'https://duende-quest.alfonso12hc.workers.dev').replace(/\/$/, '');
const SECRETO = process.env.DEPLOY_SECRET || '';
const MAX_CONECTADOS = 15;

function correr(cmd, a, env) {
  const r = spawnSync(cmd, a, { cwd: RAIZ, stdio: 'inherit', env: { ...process.env, ...(env || {}) } });
  return r.status === 0;
}
async function mantenimiento(cuerpo) {
  const r = await fetch(URL_BASE + '/api/mantenimiento', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-deploy': SECRETO }, body: JSON.stringify(cuerpo) });
  if (!r.ok) throw new Error('HTTP ' + r.status + (r.status === 404 ? ' (¿falta DEPLOY_SECRET en Cloudflare?)' : r.status === 403 ? ' (DEPLOY_SECRET no coincide)' : ''));
  return r.json();
}

console.log('1/4 Verificando…');
if (!correr(process.execPath, ['tools/verificar.mjs', ...(args.has('--sin-arnes') ? ['--sin-arnes'] : [])])) { console.error('✗ La verificación falló: no se publica.'); process.exit(1); }

let consulta = null;
if (!SECRETO) console.warn('2/4 Sin DEPLOY_SECRET: no se consulta cuántos hay ni se guarda antes (publicación como siempre).');
else {
  try {
    consulta = await mantenimiento({ solo: 1 });
    const pico = consulta.horaLima >= 12;
    console.log(`2/4 Conectados: ${consulta.on} · hora en Lima: ${consulta.horaLima}:00`);
    if (pico && consulta.on > MAX_CONECTADOS && !args.has('--forzar')) {
      console.error(`✗ Hay ${consulta.on} jugando en hora punta (12-24 h de Lima). Publica de madrugada o usa --forzar.`);
      process.exit(1);
    }
  } catch (e) {
    console.error('✗ No pude consultar el servidor: ' + e.message + '. Usa --forzar para publicar igual.');
    if (!args.has('--forzar')) process.exit(1);
    consulta = null;
  }
}

console.log('3/4 git push…');
if (!correr('git', ['push'], { DQ_VERIFICADO: '1' })) { console.error('✗ git push falló: no se cerró a nadie.'); process.exit(1); }

if (SECRETO && consulta) {
  try {
    const r = await mantenimiento({});
    console.log(`4/4 Guardados y avisados: ${r.cerrados} sesiones. Vuelven solos con la versión nueva en cuanto Cloudflare la despliegue.`);
  } catch (e) { console.warn('4/4 No pude avisar al servidor (' + e.message + '): el despliegue los reconecta igual (1012).'); }
}
console.log('✓ Publicado.');
