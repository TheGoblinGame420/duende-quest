// Pruebas de la mudanza del dominio viejo (workers.dev) a duendequest.com:
// functions/api/mudanza.js (servidor + pagina puente) y /mudanza.html (llegada).
// Uso: node tools/arnes_mudanza.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esPagina, tocaMudanza, respuestaMudanza, PUENTE } from '../functions/api/mudanza.js';
import { DOMINIO_VIEJO, SITIO } from '../functions/api/dominio.js';
import worker from '../worker.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let bien = 0, mal = 0;
const chequear = (ok, que) => { if (ok) bien++; else { mal++; console.log('  MAL: ' + que); } };

const VIEJO = 'https://' + DOMINIO_VIEJO;
const CHROME = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const pet = (u, o = {}) => new Request(u, { method: o.m || 'GET', headers: { 'User-Agent': o.ua === undefined ? CHROME : o.ua, ...(o.cookie ? { Cookie: o.cookie } : {}) } });
const toca = (u, o) => tocaMudanza(pet(u, o), new URL(u));

// ── Que es pagina y que no ──
for (const p of ['/', '/mmo/', '/mmo', '/mundo/index.html', '/game.html', '/game', '/jugar/', '/no-existe', '/mundo/galeria']) chequear(esPagina(p), 'es pagina: ' + p);
for (const p of ['/api/telegram-bot', '/api/helius-verify', '/mmo/ws', '/mmo/ev', '/mmo/cw', '/mmo/rank', '/tonconnect-manifest.json', '/assets/ui/icon-192.png', '/mmo/js/client.js', '/sw.js', '/robots.txt', '/interno/tops']) chequear(!esPagina(p), 'no es pagina: ' + p);

chequear(toca(VIEJO + '/mmo/?ref=abc'), 'el dominio viejo muda sus paginas');
chequear(!toca(SITIO + '/mmo/'), 'el dominio oficial no se toca');
chequear(!toca('https://www.duendequest.com/'), 'www del oficial no se toca');
chequear(!toca(VIEJO + '/api/telegram-bot', { m: 'POST' }) && !toca(VIEJO + '/mmo/', { m: 'POST' }), 'un POST nunca se redirige (webhooks)');
chequear(!toca(VIEJO + '/mmo/ws') && !toca(VIEJO + '/tonconnect-manifest.json') && !toca(VIEJO + '/mmo/js/client.js?v=400'), 'ni el WebSocket ni los archivos');
chequear(!toca('https://duende-quest.alfonso12hc.workers.dev.otro.com/mmo/'), 'un dominio parecido no cuenta');

// ── 301 de verdad para robots, HEAD y quien ya paso ──
{
  const u = VIEJO + '/mundo/?utm_source=meta&x=1';
  for (const [que, o] of [['Googlebot', { ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }], ['vista previa de WhatsApp', { ua: 'WhatsApp/2.23' }], ['TelegramBot', { ua: 'TelegramBot (like TwitterBot)' }], ['sin User-Agent', { ua: '' }], ['HEAD', { m: 'HEAD' }], ['cookie dqm=0', { cookie: 'a=1; dqm=0' }]]) {
    const r = respuestaMudanza(pet(u, o), new URL(u));
    chequear(r.status === 301 && r.headers.get('Location') === SITIO + '/mundo/?utm_source=meta&x=1', '301 con ruta y parametros: ' + que);
  }
  const r = respuestaMudanza(pet(u), new URL(u));
  const html = await r.text();
  chequear(r.status === 200 && /text\/html/.test(r.headers.get('Content-Type')) && r.headers.get('Cache-Control') === 'no-store', 'un navegador recibe la pagina puente, sin cache');
  chequear(html.includes('rel="canonical" href="https://duendequest.com/mundo/?utm_source=meta&amp;x=1"') && html.includes('http-equiv="refresh"'), 'la pagina puente trae canonical y refresco sin JS');
  chequear(/frame-ancestors[^;]*telegram\.org/.test(r.headers.get('Content-Security-Policy')), 'la pagina puente se puede incrustar en Telegram Web');
  chequear(!html.includes('workers.dev'), 'la pagina puente no menciona el dominio viejo');
  const feo = VIEJO + '/x%22%3E%3Cscript%3Ealert(1)%3C/script%3E?a="><b>';
  const h2 = await respuestaMudanza(pet(feo), new URL(feo)).text();
  chequear(!/<script>alert|"><b>/.test(h2), 'la ruta se escapa en el HTML');
  chequear(!respuestaMudanza(pet(VIEJO + '/?dqm=0', { cookie: 'xdqm=0' }), new URL(VIEJO + '/')).headers.get('Location'), 'una cookie parecida no cuenta');
}

// ── Navegador de mentira para correr los dos guiones ──
function almacen(ini = {}) {
  const m = new Map(Object.entries(ini));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); }, key: i => [...m.keys()][i] ?? null, get length() { return m.size; }, _m: m };
}
function correrPuente(urlTxt, guardado) {
  const u = new URL(urlTxt);
  const ctx = { localStorage: almacen(guardado), location: { pathname: u.pathname, search: u.search, hash: u.hash, replace(d) { ctx.destino = d; } }, document: { cookie: '' }, btoa, unescape, encodeURIComponent, JSON };
  vm.runInNewContext('(' + PUENTE + ')(' + JSON.stringify(SITIO) + ')', ctx);
  return ctx;
}
const guionLlegada = /<script>([\s\S]*?)<\/script>/.exec(fs.readFileSync(path.join(RAIZ, 'mudanza.html'), 'utf8'))[1];
function correrLlegada(destino, { ref = VIEJO + '/', guardado = {} } = {}) {
  const u = new URL(destino);
  const ctx = { localStorage: almacen(guardado), location: { hash: u.hash, replace(d) { ctx.destino = d; } }, document: { referrer: ref, getElementById: () => ({}) }, atob, escape, decodeURIComponent, JSON };
  vm.runInNewContext(guionLlegada, ctx);
  return ctx;
}

const TOK_A = 'a'.repeat(32), TOK_B = 'b'.repeat(32);
const SB = 'sb-abcdefghij-auth-token';
{
  // Invitado con duende: todo lo suyo viaja, lo ajeno no.
  const viejo = { dq_mmo_tok: TOK_A, dq_mmo_nombre: 'Ñusta 🌙', dq3_calidad: 'alta', dq_mmo_sonido: '0', cw_estado: '{"o":5}', [SB]: '{"access_token":"x","refresh_token":"y"}', otra_cosa: 'no', 'ton-connect-storage_bridge-connection': 'no', dq_gigante: 'z'.repeat(13000) };
  const p = correrPuente(VIEJO + '/mundo/?ref=ab12#premium', viejo);
  chequear(p.destino.startsWith(SITIO + '/mudanza#') && !/[+/=]/.test(p.destino.split('#')[1]), 'el puente salta a /mudanza con el paquete en el fragmento (base64url)');
  chequear(p.document.cookie === '', 'con cosas que llevar no se marca la cookie (se reintenta en cada visita)');
  const l = correrLlegada(p.destino);
  chequear(l.destino === '/mundo/?ref=ab12#premium', 'la llegada sigue a la misma ruta, parametros y #hash');
  chequear(l.localStorage.getItem('dq_mmo_tok') === TOK_A && l.localStorage.getItem('dq_mmo_nombre') === 'Ñusta 🌙' && l.localStorage.getItem('dq3_calidad') === 'alta' && l.localStorage.getItem('dq_mmo_sonido') === '0' && l.localStorage.getItem('cw_estado') === '{"o":5}', 'el duende, el nombre (con tildes y emoji) y los ajustes llegan');
  chequear(l.localStorage.getItem(SB) === viejo[SB], 'la sesion de la cuenta llega si se viene del dominio viejo');
  chequear(l.localStorage.getItem('otra_cosa') === null && l.localStorage.getItem('ton-connect-storage_bridge-connection') === null && l.localStorage.getItem('dq_gigante') === null, 'lo ajeno y lo enorme no viajan');

  // Quien ya juega en el dominio nuevo no pierde nada: no se pisa.
  const l2 = correrLlegada(p.destino, { guardado: { dq_mmo_tok: TOK_B, dq_mmo_nombre: 'Nuevo', [SB]: 'mia' } });
  chequear(l2.localStorage.getItem('dq_mmo_tok') === TOK_B && l2.localStorage.getItem('dq_mmo_nombre') === 'Nuevo' && l2.localStorage.getItem(SB) === 'mia', 'no se pisa el duende ni la cuenta que ya hay en el dominio nuevo');
  chequear(l2.localStorage.getItem('dq_mmo_tok_previo') === TOK_A, 'el duende viejo queda de reserva (dq_mmo_tok_previo)');
  chequear(l2.localStorage.getItem('dq3_calidad') === 'alta', 'lo que faltaba si se completa');
  const l3 = correrLlegada(p.destino, { guardado: { dq_mmo_tok: TOK_A } });
  chequear(l3.localStorage.getItem('dq_mmo_tok_previo') === null, 'repetir la mudanza con el mismo duende no crea reserva');

  // Un enlace armado por otro (no viene del dominio viejo) no mete nada.
  const l4 = correrLlegada(p.destino, { ref: 'https://sitio-malo.example/' });
  chequear(l4.localStorage.length === 0 && l4.destino === '/mundo/?ref=ab12#premium', 'desde otro sitio no se guarda nada (solo se sigue a la ruta)');
  const l5 = correrLlegada(p.destino, { ref: 'https://duende-quest.alfonso12hc.workers.dev.malo.example/' });
  chequear(l5.localStorage.length === 0, 'un dominio parecido al viejo tampoco vale');
  const l6 = correrLlegada(p.destino, { ref: '' });
  chequear(l6.localStorage.getItem('dq_mmo_tok') === TOK_A && l6.localStorage.getItem(SB) === null, 'sin procedencia llega el duende de invitado pero nunca la sesion de la cuenta');
}
{
  // Telegram: el #tgWebAppData largo sobrevive entero.
  const hash = '#tgWebAppData=' + encodeURIComponent('user=%7B%22id%22%3A1%7D&hash=' + 'f'.repeat(64)) + '&tgWebAppVersion=8.0&tgWebAppThemeParams=' + encodeURIComponent('{"bg_color":"#17212b"}');
  const p = correrPuente(VIEJO + '/telegram/index.html' + hash, { dq_mmo_sonido: '0' });
  chequear(correrLlegada(p.destino).destino === '/telegram/index.html' + hash, 'el #tgWebAppData de Telegram llega intacto');
  // Sin nada guardado: salto directo y cookie para el 301.
  const v = correrPuente(VIEJO + '/jugar/?utm_source=meta#x', { tema: 'oscuro' });
  chequear(v.destino === SITIO + '/jugar/?utm_source=meta#x' && /dqm=0/.test(v.document.cookie), 'sin nada que llevar: salto directo y cookie para el 301');
  // Mucho guardado: el duende va primero y el paquete no pasa del tope.
  const mucho = { dq_mmo_tok: TOK_A };
  for (let i = 0; i < 40; i++) mucho['dq3_relleno_' + i] = 'r'.repeat(2000);
  const g = correrPuente(VIEJO + '/mmo/', mucho);
  chequear(g.destino.length < 45000 && correrLlegada(g.destino).localStorage.getItem('dq_mmo_tok') === TOK_A, 'con mucho guardado el paquete se topa y el duende va primero');
}
{
  // La llegada nunca es un redirector abierto ni se rompe con basura.
  const paquete = o => SITIO + '/mudanza#' + Buffer.from(JSON.stringify(o)).toString('base64url');
  for (const to of ['//malo.example/x', '/\\malo.example', 'https://malo.example/', 'javascript:alert(1)', '', 5, null, '/mudanza#bucle']) chequear(correrLlegada(paquete({ v: 1, to, k: {} })).destino === '/', 'destino raro → portada: ' + JSON.stringify(to));
  for (const h of ['', '#', '#%%%', '#' + 'A'.repeat(50), '#bnVsbA', '#W10']) chequear(correrLlegada(SITIO + '/mudanza' + h).destino === '/', 'fragmento roto → portada: ' + h.slice(0, 12));
  const l = correrLlegada(paquete({ v: 1, to: '/mmo/', k: { __proto__x: 'a', token_ajeno: 'b', dq_ok: 7, dq_si: 'vale', 'sb-x': { a: 1 } } }));
  chequear(l.localStorage.length === 1 && l.localStorage.getItem('dq_si') === 'vale', 'solo entran claves nuestras con texto');
}

// ── El Worker entero ──
{
  const pedidos = [];
  const env = { ASSETS: { fetch: async r => { pedidos.push(new URL(r.url).pathname); return new Response('<html>pagina</html>', { headers: { 'Content-Type': 'text/html' } }); } } };
  const ctx = { waitUntil() {} };
  const r1 = await worker.fetch(pet(VIEJO + '/mmo/'), env, ctx);
  chequear(r1.status === 200 && (await r1.text()).includes('/mudanza#') && pedidos.length === 0, 'worker: pagina del dominio viejo → puente (sin tocar los archivos)');
  const r2 = await worker.fetch(pet(VIEJO + '/', { ua: 'curl/8.0' }), env, ctx);
  chequear(r2.status === 301 && r2.headers.get('Location') === SITIO + '/', 'worker: robot en el dominio viejo → 301');
  const r3 = await worker.fetch(pet(SITIO + '/mmo/'), env, ctx);
  chequear(r3.status === 200 && (await r3.text()) === '<html>pagina</html>' && pedidos.join() === '/mmo/' && /frame-ancestors/.test(r3.headers.get('Content-Security-Policy')) && r3.headers.get('Strict-Transport-Security'), 'worker: en el oficial la pagina se sirve tal cual, con sus cabeceras');
  const r4 = await worker.fetch(pet(VIEJO + '/tonconnect-manifest.json'), env, ctx);
  chequear(r4.status === 200 && r4.headers.get('Access-Control-Allow-Origin') === '*', 'worker: un archivo del dominio viejo se sigue sirviendo');
  const r5 = await worker.fetch(pet(VIEJO + '/mmo/rank', { m: 'POST' }), env, ctx);
  chequear(r5.status === 405, 'worker: las rutas dinamicas del dominio viejo siguen igual');
}

// ── Nada publico apunta ya al dominio viejo ──
{
  const man = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tonconnect-manifest.json'), 'utf8'));
  chequear(man.url === SITIO && [man.iconUrl, man.termsOfUseUrl, man.privacyPolicyUrl].every(u => u.startsWith(SITIO + '/')), 'el manifiesto de TON es del dominio oficial');
  chequear(fs.existsSync(path.join(RAIZ, new URL(man.iconUrl).pathname)), 'el icono del manifiesto existe');
  for (const f of ['game.html', 'mmo/js/client.js', 'telegram/index.html', 'index.html', 'mmo/index.html', 'mundo/index.html', 'mundo/js/mundo.js', 'jugar/index.html', 'inicio/index.html', 'chicha/index.html', 'chicha-wars/index.html', 'token/index.html', 'sitemap.xml', 'robots.txt', 'manifest.json', 'sw.js'].filter(f => fs.existsSync(path.join(RAIZ, f)))) {
    chequear(!fs.readFileSync(path.join(RAIZ, f), 'utf8').includes('workers.dev'), 'sin workers.dev en ' + f);
  }
  // Toda pagina publicada esta en run_worker_first (si no, en workers.dev no se muda).
  const wr = fs.readFileSync(path.join(RAIZ, 'wrangler.toml'), 'utf8');
  const lista = new Set((/run_worker_first = \[([\s\S]*?)\n\]/.exec(wr) || [, ''])[1].match(/"[^"]+"/g).map(s => s.slice(1, -1)));
  // Solo lo que esta en git se publica (el despliegue sale del repositorio).
  const fuera = new Set(['404.html', 'offline.html', 'mudanza.html', 'mundo/taller.html', 'mundo/ver_lugares.html']);
  const enGit = execFileSync('git', ['ls-files', '*.html'], { cwd: RAIZ, encoding: 'utf8' }).split('\n').map(s => s.trim()).filter(Boolean)
    .filter(f => !/^(respaldo|tools|scripts|recursos|functions|promo|_promo_kit|dist-test|netlify)/.test(f));
  chequear(enGit.length > 10, 'git lista las paginas');
  for (const f of enGit.filter(f => !fuera.has(f))) {
    const ruta = '/' + (f.endsWith('/index.html') ? f.slice(0, -10) : f === 'index.html' ? '' : f.slice(0, -5));
    chequear(lista.has(ruta), 'pagina en run_worker_first: ' + ruta + ' (' + f + ')');
  }
  chequear(lista.size <= 100, 'run_worker_first no pasa de 100 entradas');
}

console.log(`\nMudanza de dominio: ${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
