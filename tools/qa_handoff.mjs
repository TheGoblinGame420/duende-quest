// ═══════════════════════════════════════════════════════
// Handoff Telegram -> navegador de punta a punta, en un Chrome real contra el
// servidor local (node tools/mmo_local.mjs):
//   enlace ?ott= -> canje -> cookie HttpOnly -> el MISMO duende de Telegram ->
//   portada con la cuenta -> cerrar sesión (servidor + navegador vacío).
//
//   node tools/qa_handoff.mjs [http://localhost:8787]
//
// El initData de mentira se firma con el token de bot SOLO de pruebas de mmo_local.
// ═══════════════════════════════════════════════════════
import { abrirNavegador } from './cdp.mjs';

const BASE = (process.argv[2] || 'http://localhost:8787').replace(/\/$/, '');
const TOKEN_BOT_LOCAL = '1000000:local-solo-pruebas';   // el mismo de tools/mmo_local.mjs
const TG_ID = 424200 + Math.floor(Math.random() * 99);
let bien = 0, mal = 0;
const chequear = (ok, txt) => { if (ok) { bien++; console.log('  ✓ ' + txt); } else { mal++; console.log('  ✗ MAL: ' + txt); } };

async function initData(id, nombre) {
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: nombre, username: nombre }) });
  const datos = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const enc = new TextEncoder();
  const hmac = async (clave, txt) => crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', clave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), enc.encode(txt));
  const firma = await hmac(await hmac(enc.encode('WebAppData'), TOKEN_BOT_LOCAL), datos);
  p.set('hash', [...new Uint8Array(firma)].map(b => b.toString(16).padStart(2, '0')).join(''));
  return p.toString();
}
const pedirOtt = async () => {
  const r = await fetch(BASE + '/api/auth/telegram-handoff', { method: 'POST', headers: { Origin: BASE, 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: await initData(TG_ID, 'QaTg' + (TG_ID % 100)) }) });
  return (await r.json()).ott || '';
};
const dev = async js => { const r = await (await fetch(BASE + '/__dev?js=' + encodeURIComponent(js))).json(); if (!r.ok) throw new Error(r.e); return r.v; };
const uids = () => dev(`[...mundo.sesiones.values()].filter(s => s.c).map(s => s.c.uid)`);
const esperarUid = async (re, ms = 45000) => { const fin = Date.now() + ms; while (Date.now() < fin) { const l = await uids(); if (l.some(u => re.test(u))) return l; await new Promise(r => setTimeout(r, 400)); } return uids(); };

const nav = await abrirNavegador({ ancho: 1100, alto: 720 });
try {
  // Los confirm() de la página se aceptan (y se apuntan).
  const dialogos = [];
  nav.escuchar(m => { if (m.method === 'Page.javascriptDialogOpening') { dialogos.push(m.params.message); nav.cmd('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); } });
  await nav.cmd('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('dq_mmo_sonido', '0'); localStorage.setItem('dq_mudo', '1'); } catch (e) {}` });
  // Estado previo del navegador: un invitado, una sesión de correo vieja y un token de aparato viejo (el «cruce de sesiones»).
  await nav.ir(BASE + '/offline.html');
  await nav.js(`localStorage.setItem('dq_mmo_tok', 'a'.repeat(32)); localStorage.setItem('dq_mmo_nombre', 'Duende6586'); localStorage.setItem('sb-prueba-auth-token', '{"access_token":"viejo"}'); localStorage.setItem('dq_dt', 'b'.repeat(32)); 1`);

  console.log('1. Enlace de un uso → el juego entra con la cuenta de Telegram');
  const ott1 = await pedirOtt();
  chequear(/^[a-f0-9]{32}$/.test(ott1), 'el servidor da un OTT con el initData firmado');
  await nav.ir(BASE + '/mundo/?ott=' + ott1);
  await nav.esperar(1500);
  chequear(!/ott=/.test(await nav.js('location.href')), 'el enlace sale de la barra de direcciones al cargar');
  chequear(dialogos.some(d => /ya tiene una cuenta abierta/.test(d)), 'como el navegador tenía otra cuenta abierta, pregunta antes de cambiarla');
  const l1 = await esperarUid(new RegExp('^tg:' + TG_ID + '$'));
  chequear(l1.includes('tg:' + TG_ID), 'el navegador entra al mundo como tg:' + TG_ID + ' (no como invitado ni con la sesión vieja)');
  const st = await nav.js(`JSON.stringify({ ck: localStorage.getItem('dq_ck'), sb: localStorage.getItem('sb-prueba-auth-token'), dt: localStorage.getItem('dq_dt'), inv: localStorage.getItem('dq_mmo_tok'), cookie: document.cookie })`).then(JSON.parse);
  chequear(st.ck === '1' && st.sb === null && st.dt === null, 'las sesiones previas del navegador (correo y token viejo) se cerraron');
  chequear(st.inv === 'a'.repeat(32), 'el duende de invitado del aparato no se borra (no es una cuenta)');
  chequear(!/dq_s=/.test(st.cookie), 'la cookie de sesión es HttpOnly: el JavaScript de la página no la ve');
  const ck = await nav.cmd('Network.getCookies', { urls: [BASE + '/'] });
  const c = (ck.cookies || []).find(x => x.name === 'dq_s');
  chequear(!!c && c.httpOnly && c.secure && c.sameSite === 'Lax', 'el navegador guarda dq_s como HttpOnly; Secure; SameSite=Lax');

  console.log('2. Recargar: sigue siendo el mismo duende (sin enlace)');
  await nav.ir(BASE + '/mundo/');
  await new Promise(r => setTimeout(r, 2500));
  const l2 = await esperarUid(new RegExp('^tg:' + TG_ID + '$'));
  chequear(l2.includes('tg:' + TG_ID) && !l2.some(u => u.startsWith('inv:')), 'al volver entra otra vez con la cuenta de Telegram');

  console.log('3. El mismo enlace no sirve dos veces');
  const nav2 = await abrirNavegador({ ancho: 900, alto: 600 });
  try {
    await nav2.ir(BASE + '/?ott=' + ott1);
    await nav2.esperarA(`!!document.getElementById('dq-portada-toast')`, 15000).catch(() => {});
    const t2 = await nav2.js(`(document.getElementById('dq-portada-toast') || {}).textContent || ''`);
    chequear(/ya se usó|caducó/.test(t2) && (await nav2.js(`localStorage.getItem('dq_ck')`)) === null, 'otro navegador con el enlace ya gastado no entra: «' + t2.slice(0, 50) + '…»');
  } finally { await nav2.cerrar(); }

  console.log('4. La portada reconoce la cuenta');
  await nav.ir(BASE + '/');
  await nav.esperarA(`/Continuar con/.test((document.getElementById('hero-cta-movil') || {}).textContent || '')`, 15000).catch(() => {});
  const p4 = await nav.js(`JSON.stringify({ cta: document.getElementById('hero-cta-movil').textContent, nav: document.getElementById('nav-cuenta').textContent, inv: document.getElementById('hero-ent-inv').hidden })`).then(JSON.parse);
  chequear(/Continuar con QaTg/.test(p4.cta) && /QaTg/.test(p4.nav) && p4.inv === true, 'el botón principal dice «' + p4.cta + '» y ya no ofrece «invitado»');

  console.log('5. Cerrar sesión de verdad');
  await nav.js(`new Promise(r => { const q = indexedDB.open('dq_prueba_idb'); q.onsuccess = () => { q.result.close(); r(1); }; q.onerror = () => r(0); })`);
  await nav.js(`sessionStorage.setItem('dq_marca_ss', '1'); localStorage.setItem('dq_marca_ls', '1'); 1`);
  const t5 = Date.now();
  // Sin esperar a la promesa: la página navega a la portada en mitad y el contexto se destruye.
  await nav.cmd('Runtime.evaluate', { expression: `import('/js/llave.js?v=' + (document.querySelector('script[src*="?v="]').src.match(/v=(\\d+)/) || [])[1]).then(m => m.cerrarSesionTotal({ preguntar: false })); 1`, awaitPromise: false });
  let p5 = null;
  for (let i = 0; i < 60 && !p5; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const x = await nav.js(`(async () => JSON.stringify({ lista: location.pathname === '/' && !localStorage.getItem('dq_marca_ls') && document.readyState === 'complete', claves: Object.keys(localStorage).filter(k => /^(dq_ck|dq_dt|dq_mmo_tok|dq_mmo_nombre|dq_marca|sb-)/.test(k)), ss: sessionStorage.getItem('dq_marca_ss') ? 1 : 0, idb: indexedDB.databases ? (await indexedDB.databases()).map(d => d.name) : [], ruta: location.pathname }))()`).then(JSON.parse);
      if (x.lista) p5 = x;
    } catch (e) {}
  }
  console.log('     cierre completo en ' + ((Date.now() - t5) / 1000).toFixed(1) + ' s');
  p5 = p5 || { claves: ['?'], ss: 1, idb: [], ruta: '?' };
  chequear(p5.claves.length === 0 && p5.ss === 0 && !p5.idb.includes('dq_prueba_idb') && p5.ruta === '/', 'lo que el juego guardó (localStorage, sessionStorage, IndexedDB) ya no está y vuelve a la portada');
  const ck5 = await nav.cmd('Network.getCookies', { urls: [BASE + '/'] });
  chequear(!(ck5.cookies || []).some(x => x.name === 'dq_s'), 'la cookie de sesión ya no existe');
  const quedan = await dev(`(() => { let n = 0; for (const s of mundo.sesiones.values()) if (s.c && s.c.uid === 'tg:${TG_ID}') n++; return n; })()`);
  chequear(quedan === 0, 'su sesión abierta en el mundo se cerró');
  await nav.ir(BASE + '/mundo/');
  await new Promise(r => setTimeout(r, 9000));
  const l5 = await uids();
  chequear(!l5.includes('tg:' + TG_ID), 'al volver a entrar ya no es la cuenta de Telegram (el token murió en el servidor): ' + JSON.stringify(l5.slice(-2)));
  const exc = nav.consola.filter(x => x.startsWith('EXCEPCION'));
  chequear(exc.length === 0, 'sin excepciones en la consola' + (exc.length ? ': ' + exc.slice(0, 2).join(' | ').slice(0, 300) : ''));
} finally { await nav.cerrar(); }
console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
