// ═══════════════════════════════════════════════════════
// Prueba de humo contra PRODUCCION tras un despliegue: entra con el
// invitado de pruebas (token '8'×32, esta en UIDS_PRUEBA y no sale en el
// ranking), elige clase, va a una zona, usa una habilidad y sale.
//
//   node tools/humo_produccion.mjs [url]
//
// tools/ no se publica (.assetsignore).
// ═══════════════════════════════════════════════════════
const url = process.argv[2] || 'wss://duende-quest.alfonso12hc.workers.dev/mmo/ws';
// Paginas para los anuncios de Meta: /jugar/ sin nada de cripto y la portada sin
// promesas falsas (cofres, ticker, contador). Se revisan por HTTP antes del WebSocket.
const web = url.replace(/^ws/, 'http').replace(/\/mmo\/ws.*$/, '');
const verPagina = async (ruta) => { try { const r = await fetch(web + ruta, { cache: 'no-store' }); return { ok: r.ok, txt: await r.text() }; } catch (e) { return { ok: false, txt: '' }; } };
const jugar = await verPagina('/jugar/');
console.log((jugar.ok ? 'OK  ' : 'MAL ') + '/jugar/ responde');
console.log((jugar.ok && !/\$DUENDE|token|pump|solana|wallet|cripto/i.test(jugar.txt) ? 'OK  ' : 'MAL ') + '/jugar/ sin palabras cripto');
console.log((/noindex/.test(jugar.txt) && /id="jugar"/.test(jugar.txt) ? 'OK  ' : 'MAL ') + '/jugar/ con noindex y boton JUGAR');
const portada = await verPagina('/');
console.log((portada.ok && !/TICKER_EVENTS|initCountdown|Garantiza un objeto legendario|se activa sola/.test(portada.txt) ? 'OK  ' : 'MAL ') + 'portada sin ticker, contador ni cofres falsos');
console.log((/classList\.add\('anuncio'\)/.test(portada.txt) ? 'OK  ' : 'MAL ') + 'portada con modo anuncio (fbclid/utm)');
// Vista previa al compartir: se pide como el robot de Facebook/WhatsApp. Cada pagina de
// entrada lleva og:title/og:description sin "$DUENDE" ni "token" y una og:image absoluta
// que responde como imagen (si falla, limpiar la cache con el depurador de Meta).
const UA_FB = { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' };
const og = (txt, p) => { const m = txt.match(new RegExp('<meta property="og:' + p + '" content="([^"]*)"')); return m ? m[1] : ''; };
// /chicha/: destino del QR de la botella. Sin cripto, sin promesa nueva, con los requisitos reales de
// CHICHA (si se cambian en data.js, esta prueba avisa de que la pagina quedo vieja) y el QR publicado.
const chicha = await verPagina('/chicha/?utm_source=etiqueta');
console.log((chicha.ok && /C[aá]ntaro Eterno/.test(chicha.txt) && /id="jugar"/.test(chicha.txt) ? 'OK  ' : 'MAL ') + '/chicha/ responde con su portada y boton JUGAR');
console.log((chicha.ok && !/\$DUENDE|token|pump|solana|wallet|cripto/i.test(chicha.txt) ? 'OK  ' : 'MAL ') + '/chicha/ sin palabras cripto');
const { CHICHA } = await import('../mmo/js/data.js');
const faltanChicha = [`nivel ${CHICHA.nv60}`, `${CHICHA.litros60} litros`, `${CHICHA.dias60} días jugados`, `${Math.round(CHICHA.min60 / 60)} horas de juego`, `${CHICHA.mesMax60} premios`, `${CHICHA.mesMax} litros por puntos`, CHICHA.whatsappVer, 'wa.me/' + CHICHA.whatsapp, ...CHICHA.niveles.map(n => n.toLocaleString('es', { useGrouping: 'always' }))].filter(x => !chicha.txt.includes(x));
console.log((chicha.ok && !faltanChicha.length ? 'OK  ' : 'MAL ') + '/chicha/ con los datos reales de CHICHA' + (faltanChicha.length ? ' (no dice: ' + faltanChicha.join(', ') + ')' : ''));
for (const [ruta, tipo] of [['/assets/etiqueta/qr-chicha.png', /^image\/png/], ['/assets/etiqueta/qr-chicha.svg', /^image\/svg/]]) {
  let ok = false;
  try { const r = await fetch(web + ruta, { cache: 'no-store' }); ok = r.ok && tipo.test(r.headers.get('content-type') || ''); } catch (e) {}
  console.log((ok ? 'OK  ' : 'MAL ') + ruta + ' publicado');
}
for (const ruta of ['/', '/jugar/', '/chicha/', '/inicio/', '/mundo/', '/mmo/']) {
  let txt = '', ok = false;
  try { const r = await fetch(web + ruta, { cache: 'no-store', headers: UA_FB }); ok = r.ok; txt = await r.text(); } catch (e) {}
  const img = og(txt, 'image');
  let imgOk = false;
  if (/^https:\/\//.test(img)) { try { const r = await fetch(img, { headers: UA_FB }); imgOk = r.ok && /^image\//.test(r.headers.get('content-type') || ''); } catch (e) {} }
  const limpio = og(txt, 'title') && !/\$DUENDE|token/i.test(og(txt, 'title') + ' ' + og(txt, 'description'));
  console.log((ok && limpio && imgOk ? 'OK  ' : 'MAL ') + ruta + ' vista previa (og) para facebookexternalhit');
}
const ws = new WebSocket(url);
const vistos = {};
let yo = null;
const toasts = [];
const fin = (ok, txt) => { console.log((ok ? 'OK  ' : 'MAL ') + txt); };
const mandar = o => ws.send(JSON.stringify(o));
const esperar = ms => new Promise(r => setTimeout(r, ms));
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  vistos[m.t] = (vistos[m.t] || 0) + 1;
  if (m.t === 'bienvenido' || m.t === 'yo') yo = m.yo;
  if (m.t === 'err') console.log('err:', m.m);
  if (m.t === 'toast') toasts.push(m.m);
};
ws.onopen = async () => {
  mandar({ t: 'hola', auth: { k: 'inv', tok: '8'.repeat(32) }, nombre: 'Probador' });
  await esperar(2500);
  fin(!!vistos.bienvenido, 'entra al mundo (' + (yo ? 'Nv ' + yo.nivel + ', clase ' + yo.clase : 'sin datos') + ')');
  if (yo && !yo.clase) { mandar({ t: 'clase', id: 'mago' }); await esperar(800); }
  fin(yo && yo.clase, 'tiene clase: ' + (yo && yo.clase));
  fin(yo && typeof yo.recMax === 'number' && yo.pid, 'datos nuevos en "yo" (recurso, id público)');
  fin((vistos.s || 0) > 5, 'llegan fotos del mundo (' + (vistos.s || 0) + ')');
  fin(yo && yo.boveda && yo.boveda.sem, 'la Bóveda semanal llega en "yo" (semana ' + (yo && yo.boveda && yo.boveda.sem) + ')');
  mandar({ t: 'quien' });
  mandar({ t: 'lfgLista' });
  mandar({ t: 'contactos' });
  mandar({ t: 'pedido', id: 'skin_king', metodo: 'sol' });
  mandar({ t: 'atk', s: 0 });
  await esperar(1000);
  fin(!!vistos.quien, 'responde la lista de jugadores');
  fin(!!vistos.lfg, 'responde la lista del buscador de grupo');
  fin(!!vistos.contactos, 'responde la lista de amigos');
  fin(toasts.some(t => /cuenta/.test(t)), 'la tienda premium pide cuenta a un invitado (skins con SOL)');
  ws.close();
  setTimeout(() => process.exit(0), 300);
};
ws.onerror = e => { console.log('MAL no conecta', e.message || ''); process.exit(1); };
