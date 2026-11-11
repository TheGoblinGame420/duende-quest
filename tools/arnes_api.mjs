// ═══════════════════════════════════════════════════════
// Arnes del webhook del bot (functions/api/telegram-bot.js) con fetch falso:
// Telegram, Supabase y el Durable Object del MMO son de mentira y se puede
// hacer que fallen. Comprueba que un pago de Stars SIEMPRE avisa al dueño
// cuando algo falla tras cobrar, y que /paysupport, /terms y /miscompras
// responden. Nada sale a la red.
//
//   node tools/arnes_api.mjs
//
// tools/ no se publica (.assetsignore).
// ═══════════════════════════════════════════════════════
import bot from '../functions/api/telegram-bot.js';

const ADMIN = '999';
let enviados = [];            // { metodo, body } de cada llamada a Telegram
let filas = [];               // stars_purchases falsa
let supabaseCaido = false;
let fallos = 0, pruebas = 0;

globalThis.fetch = async (url, op = {}) => {
  url = String(url);
  const body = op.body ? JSON.parse(op.body) : null;
  const resp = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
  if (url.startsWith('https://api.telegram.org/')) {
    enviados.push({ metodo: url.split('/').pop(), body });
    return resp({ ok: true, result: true });
  }
  if (url.includes('/rest/v1/stars_purchases')) {
    if (supabaseCaido) return new Response('<html>502</html>', { status: 502 });
    if ((op.method || 'GET') === 'POST') {
      if (filas.some(f => f.tx_id === body.tx_id)) return resp({ code: '23505', message: 'duplicate key' }, 409);
      const f = { ...body, created_at: new Date().toISOString() };
      filas.push(f);
      return resp([f], 201);
    }
    const m = /tx_id=eq\.([^&]+)/.exec(url);
    if (m) return resp(filas.filter(f => f.tx_id === decodeURIComponent(m[1])));
    const t = /telegram_id=eq\.([^&]+)/.exec(url);
    return resp(t ? filas.filter(f => f.telegram_id === decodeURIComponent(t[1])) : filas);
  }
  if (url.includes('/rest/v1/')) return supabaseCaido ? new Response('x', { status: 502 }) : resp([]);
  // Precio de $DUENDE (pump.fun / DexScreener)
  return resp({ usd_market_cap: 50000, total_supply: 1e15, pairs: [{ priceUsd: '0.00005' }] });
};

// Durable Object falso: modo 'ok', 'caido' (lanza), 'noOk' (responde ok:false) o 'colgado'.
let modoMmo = 'ok';
const alertasFalsas = { compras: true, registros: true, cupo: false }, alertasPedidas = [];   // /alertas (functions/mmo/alertas.js)
const MMO = {
  idFromName: () => 'id',
  get: () => ({
    fetch: async (u, op) => {
      const accion = String(u).split('/').pop();
      if (modoMmo === 'caido') throw new Error('DO no disponible');
      if (modoMmo === 'colgado') return new Promise(() => {});
      if (modoMmo === 'noOk') return new Response(JSON.stringify({ ok: false, error: 'pedido desconocido' }));
      if (accion === 'misCompras') return new Response(JSON.stringify({ ok: true, l: [{ codigo: 'AB12CD', nombre: 'Skin Cósmico', estado: 'pagado', metodo: 'stars', charge: 'cargoMMO1', pagadoEn: Date.now() }] }));
      if (accion === 'alertas') {
        const b = JSON.parse(op.body || '{}');
        if (b.tipo) { alertasPedidas.push(b); alertasFalsas[b.tipo] = b.on; }
        return new Response(JSON.stringify({ ok: true, tipos: Object.entries(alertasFalsas).map(([id, on]) => ({ id, corto: id, nombre: 'Aviso de ' + id, on })) }));
      }
      return new Response(JSON.stringify({ ok: true, nombre: 'Skin Cósmico' }));
    },
  }),
};
const env = { TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_WEBHOOK_SECRET: 's', ADMIN_TG_ID: ADMIN, SUPABASE_SERVICE_KEY: 'k', MMO };
const espera = [];
const llamar = async upd => {
  const req = new Request('https://x/api/telegram-bot', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': 's' }, body: JSON.stringify(upd) });
  const r = await bot.onRequestPost({ request: req, env, waitUntil: p => espera.push(p) });
  return r.status;
};
const pago = (payload, cargo, stars = 100) => ({ message: { message_id: 1, chat: { id: 555 }, from: { id: 555, username: 'jugador' }, successful_payment: { currency: 'XTR', total_amount: stars, invoice_payload: JSON.stringify(payload), telegram_payment_charge_id: cargo } } });
const texto = (t) => ({ message: { message_id: 2, chat: { id: 555 }, from: { id: 555 + Math.floor(Math.random() * 1e6) }, text: t } });
const alDueno = () => enviados.filter(e => e.metodo === 'sendMessage' && String(e.body.chat_id) === ADMIN);
const alCliente = () => enviados.filter(e => e.metodo === 'sendMessage' && String(e.body.chat_id) === '555');
function ok(cond, nombre) {
  pruebas++;
  if (cond) console.log('  ✓ ' + nombre);
  else { fallos++; console.log('  ✗ ' + nombre); }
}
const reset = () => { enviados = []; };

console.log('Pagos de Stars');
// 1) Todo bien: pedido del MMO registrado, cliente avisado, sin aviso de fallo.
reset(); modoMmo = 'ok';
await llamar(pago({ mmo: 'AB12CD' }, 'cargo1'));
ok(alCliente().some(e => /Pago recibido/.test(e.body.text)) && !alDueno().some(e => /sin pedido confirmado/.test(e.body.text)), 'MMO responde: el cliente recibe la confirmación y no hay alarma');

// 2) DO caído: aviso obligatorio al dueño con el código y el cargo.
reset(); modoMmo = 'caido';
await llamar(pago({ mmo: 'ZZ99XX' }, 'cargo2'));
const a2 = alDueno().find(e => /Stars cobradas sin pedido confirmado #ZZ99XX/.test(e.body.text));
ok(!!a2 && /Cargo: cargo2/.test(a2.body.text), 'DO caído: el dueño recibe «Stars cobradas sin pedido confirmado #ZZ99XX» con el cargo');
ok(!!a2 && a2.body.reply_markup && /^stno:/.test(a2.body.reply_markup.inline_keyboard[0][0].callback_data), 'el aviso trae el botón Devolver');
ok(alCliente().some(e => /lo revisamos/i.test(e.body.text)), 'DO caído: el cliente recibe «pago recibido, lo revisamos»');

// 3) DO responde ok:false.
reset(); modoMmo = 'noOk';
await llamar(pago({ mmo: 'QQ11WW' }, 'cargo3'));
ok(alDueno().some(e => /sin pedido confirmado #QQ11WW/.test(e.body.text) && /no confirmó/.test(e.body.text)), 'DO con ok:false: aviso obligatorio');

// 4) DO colgado: el plazo de 15 s salta y avisa igual (reloj de setTimeout acelerado).
reset(); modoMmo = 'colgado';
const stReal = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...a) => stReal(fn, Math.min(ms, 20), ...a);
await llamar(pago({ mmo: 'HH22JJ' }, 'cargo4'));
globalThis.setTimeout = stReal;
ok(alDueno().some(e => /sin pedido confirmado #HH22JJ/.test(e.body.text) && /no respondió/.test(e.body.text)), 'DO colgado: aviso obligatorio tras el plazo');

// 5) Reintento del webhook (mismo cargo): no se repite nada.
reset(); modoMmo = 'ok';
await llamar(pago({ mmo: 'AB12CD' }, 'cargo1'));
ok(enviados.length === 0, 'reintento del mismo cargo: silencio (ya se atendió)');

// 6) Supabase caído en una skin del arcade: aviso obligatorio.
reset(); supabaseCaido = true;
await llamar(pago({ skin_id: 'cosmico' }, 'cargo5'));
supabaseCaido = false;
ok(alDueno().some(e => /sin pedido confirmado/.test(e.body.text) && /Supabase/.test(e.body.text)), 'Supabase caído (skin): aviso obligatorio');
ok(alCliente().some(e => /lo revisamos/i.test(e.body.text)), 'Supabase caído (skin): el cliente sabe que se revisa');

// 7) Payload roto: el catch avisa al dueño (antes solo al cliente).
reset();
const roto = pago({}, 'cargo6'); roto.message.successful_payment.invoice_payload = '{no es json';
await llamar(roto);
ok(alDueno().some(e => /sin pedido confirmado/.test(e.body.text) && /error inesperado/.test(e.body.text)), 'error inesperado: aviso obligatorio al dueño');

// 8) Compra de $DUENDE normal: aviso «por revisar» con /starsok, nada se acredita solo.
reset();
await llamar(pago({ pkg: 0, tokens: 1000, usd: 1 }, 'cargo7', 77));
ok(alDueno().some(e => /por revisar/.test(e.body.text) && /\/starsok cargo7/.test(e.body.text)), '$DUENDE: aviso «por revisar» con /starsok (entrega manual)');
ok(filas.find(f => f.tx_id === 'cargo7').tokens_credited === 0, '$DUENDE: queda sin acreditar hasta que el dueño lo revise');

console.log('Comandos de soporte');
reset();
await llamar(texto('/paysupport'));
ok(enviados.some(e => e.metodo === 'sendMessage' && /Ayuda con un pago/.test(e.body.text)), '/paysupport responde texto fijo');
await llamar(texto('/terms'));
ok(enviados.some(e => e.metodo === 'sendMessage' && /Condiciones de compra/.test(e.body.text)), '/terms responde texto fijo');
await Promise.all(espera);
ok(enviados.some(e => e.metodo === 'setMyCommands' && e.body.commands.some(c => c.command === 'paysupport') && e.body.commands.some(c => c.command === 'terms')), 'setMyCommands registra /paysupport y /terms');
reset(); modoMmo = 'ok';
await llamar({ message: { message_id: 3, chat: { id: 555 }, from: { id: 555 }, text: '/miscompras' } });
const mc = enviados.find(e => e.metodo === 'sendMessage' && /Tus compras/.test(e.body.text));
ok(!!mc && /#AB12CD/.test(mc.body.text) && /En revisión|Acreditado|Por entregar/.test(mc.body.text), '/miscompras lista los pedidos del MMO y del arcade');
ok(!enviados.some(e => e.metodo === 'refundStarPayment'), 'nadie devuelve ni entrega solo');

console.log('/alertas: qué avisos recibe el dueño');
const delDueno = t => ({ message: { message_id: 7, chat: { id: Number(ADMIN) }, from: { id: Number(ADMIN) }, text: t } });
reset(); modoMmo = 'ok';
await llamar(texto('/alertas'));
ok(enviados.length === 0 && alertasPedidas.length === 0, '/alertas de alguien que no es el dueño: silencio');
await llamar(texto('/alertas compras off'));
ok(enviados.length === 0 && alertasPedidas.length === 0, 'y no puede cambiar nada');
reset();
await llamar(delDueno('/alertas'));
const va = alDueno().find(e => /Tus alertas/.test(e.body.text));
ok(!!va && /✅ Aviso de compras/.test(va.body.text) && /🔕 Aviso de cupo/.test(va.body.text) && /no se publica solo/.test(va.body.text), '/alertas del dueño: lista con lo encendido y lo apagado');
ok(!!va && va.body.reply_markup.inline_keyboard.flat().some(b => b.callback_data === 'al:compras:0') && va.body.reply_markup.inline_keyboard.flat().some(b => b.callback_data === 'al:cupo:1'), 'cada aviso trae su botón para cambiarlo');
reset();
await llamar(delDueno('/alertas cupo on'));
ok(alertasPedidas.some(b => b.tipo === 'cupo' && b.on === true) && alDueno().some(e => /✅ Aviso de cupo/.test(e.body.text)), '/alertas cupo on lo enciende y muestra la lista');
reset();
await llamar(delDueno('/alertas compras quizas'));
ok(alDueno().some(e => /^Uso: \/alertas/.test(e.body.text)) && !alertasPedidas.some(b => b.tipo === 'compras'), '/alertas con un valor raro explica el uso y no cambia nada');
const boton = (de, data) => ({ callback_query: { id: 'cb1', from: { id: de }, data, message: { message_id: 9, chat: { id: de }, text: 'x' } } });
reset();
await llamar(boton(555, 'al:compras:0'));
ok(!alertasPedidas.some(b => b.tipo === 'compras') && !enviados.some(e => e.metodo === 'editMessageText'), 'el botón de otra persona no cambia nada');
await llamar(boton(Number(ADMIN), 'al:compras:0'));
const ed = enviados.find(e => e.metodo === 'editMessageText');
ok(alertasPedidas.some(b => b.tipo === 'compras' && b.on === false) && !!ed && /🔕 Aviso de compras/.test(ed.body.text), 'el botón del dueño apaga el aviso y repinta la lista');
ok(enviados.every(e => e.metodo !== 'sendMessage' || String(e.body.chat_id) === ADMIN), '/alertas no escribe a nadie más que al dueño');

console.log(`\n${pruebas - fallos}/${pruebas} pruebas bien`);
process.exit(fallos ? 1 : 0);
