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
const ws = new WebSocket(url);
const vistos = {};
let yo = null;
const fin = (ok, txt) => { console.log((ok ? 'OK  ' : 'MAL ') + txt); };
const mandar = o => ws.send(JSON.stringify(o));
const esperar = ms => new Promise(r => setTimeout(r, ms));
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  vistos[m.t] = (vistos[m.t] || 0) + 1;
  if (m.t === 'bienvenido' || m.t === 'yo') yo = m.yo;
  if (m.t === 'err') console.log('err:', m.m);
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
  mandar({ t: 'atk', s: 0 });
  await esperar(1000);
  fin(!!vistos.quien, 'responde la lista de jugadores');
  fin(!!vistos.lfg, 'responde la lista del buscador de grupo');
  ws.close();
  setTimeout(() => process.exit(0), 300);
};
ws.onerror = e => { console.log('MAL no conecta', e.message || ''); process.exit(1); };
