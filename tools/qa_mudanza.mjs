// Prueba de punta a punta de la mudanza EN PRODUCCION, con un Chrome de verdad:
// guarda un duende de mentira en el dominio viejo, entra por una pagina vieja
// y comprueba que llega a duendequest.com con la misma ruta y sus cosas.
// No abre el juego (usa /terminos): la llave de prueba nunca se conecta.
// Uso: node tools/qa_mudanza.mjs
import { abrirNavegador } from './cdp.mjs';

const VIEJO = 'https://duende-quest.alfonso12hc.workers.dev';
const NUEVO = 'https://duendequest.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
let bien = 0, mal = 0;
const chequear = (ok, que, extra = '') => { if (ok) { bien++; console.log('OK   ' + que); } else { mal++; console.log('MAL  ' + que + (extra ? ' → ' + extra : '')); } };

const nav = await abrirNavegador();
try {
  await nav.cmd('Network.enable');
  await nav.cmd('Network.setUserAgentOverride', { userAgent: UA });
  const tok = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');

  // 1. Sin nada guardado: salto directo, misma ruta, parametros y #hash.
  await nav.ir(VIEJO + '/terminos?x=1&y=dos#abajo');
  await nav.esperarA(`location.origin === ${JSON.stringify(NUEVO)} && document.readyState === 'complete'`, 15000);
  let u = await nav.js('location.href');
  chequear(u === NUEVO + '/terminos?x=1&y=dos#abajo', 'visitante nuevo: misma ruta, parametros y #hash', u);

  // 2. Con duende guardado en el dominio viejo (se escribe desde un archivo suyo, que no redirige).
  await nav.ir(VIEJO + '/robots.txt');
  await nav.js(`localStorage.setItem('dq_mmo_tok', ${JSON.stringify(tok)}); localStorage.setItem('dq_mmo_nombre', 'Ñusta de prueba'); localStorage.setItem('dq3_calidad', 'alta'); localStorage.setItem('ajeno', 'no'); document.cookie = 'dqm=; Max-Age=0; Path=/'; 1`);
  await nav.ir(VIEJO + '/terminos?z=9#pie');
  await nav.esperarA(`location.origin === ${JSON.stringify(NUEVO)} && location.pathname !== '/mudanza' && document.readyState === 'complete'`, 15000);
  u = await nav.js('location.href');
  chequear(u === NUEVO + '/terminos?z=9#pie', 'invitado: llega a la misma pagina', u);
  const g = JSON.parse(await nav.js(`JSON.stringify({ t: localStorage.getItem('dq_mmo_tok'), n: localStorage.getItem('dq_mmo_nombre'), c: localStorage.getItem('dq3_calidad'), a: localStorage.getItem('ajeno') })`));
  chequear(g.t === tok && g.n === 'Ñusta de prueba' && g.c === 'alta', 'invitado: su duende, su nombre y sus ajustes llegaron', JSON.stringify(g));
  chequear(g.a === null, 'lo ajeno no viaja');

  // 3. Volver a entrar por el dominio viejo no pisa lo que ya hay en el nuevo.
  await nav.js(`localStorage.setItem('dq3_calidad', 'baja'); 1`);
  await nav.ir(VIEJO + '/privacidad');
  await nav.esperarA(`location.origin === ${JSON.stringify(NUEVO)} && location.pathname !== '/mudanza' && document.readyState === 'complete'`, 15000);
  chequear(await nav.js(`localStorage.getItem('dq3_calidad')`) === 'baja' && await nav.js(`localStorage.getItem('dq_mmo_tok')`) === tok, 'segunda pasada: no pisa nada');

  // 4. Un enlace a /mudanza armado desde fuera no mete nada.
  const otro = 'c'.repeat(32);
  const paquete = Buffer.from(JSON.stringify({ v: 1, to: '//example.com/', k: { dq_dt: otro, 'sb-x-auth-token': 'robada' } })).toString('base64url');
  await nav.ir('https://example.com/');
  await nav.js(`location.href = ${JSON.stringify(NUEVO + '/mudanza#' + paquete)}; 1`);
  await nav.esperarA(`location.origin === ${JSON.stringify(NUEVO)} && location.pathname === '/' && document.readyState !== 'loading'`, 15000);
  chequear(await nav.js(`localStorage.getItem('dq_dt')`) === null && await nav.js(`localStorage.getItem('sb-x-auth-token')`) === null, 'enlace armado desde otro sitio: no guarda nada y cae en la portada');

  // Limpieza de la prueba.
  await nav.js(`['dq_mmo_tok','dq_mmo_nombre','dq3_calidad'].forEach(k => localStorage.removeItem(k)); 1`);
} catch (e) {
  mal++; console.log('MAL  la prueba se cortó: ' + e.message + ' (estaba en ' + (await nav.js('location.href').catch(() => '?')) + ')');
} finally { await nav.cerrar(); }
console.log(`\nMudanza en producción: ${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
