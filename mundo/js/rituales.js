// ── RITUALES DEL DÍA (ORIGINS) ──
// La cara del ciclo de mañana y noche de functions/mmo/rituales.js:
//   · «Buenos días»: tarjeta pequeña al primer ingreso del día (hora de Perú) con lo
//     que te espera y el regalo del amanecer (y la olla, si ya reposó).
//   · «Ritual de la noche» (18:00-03:59): ventana de menos de un minuto para mandar
//     la expedición, dejar la olla al fuego y elegir la intención de mañana; al
//     cerrar el día, lo logrado hoy y el gancho de la historia.
//   · Recordatorio por Telegram: por la mañana, por la noche, ambos o ninguno, a la
//     hora que elijas. Solo se envía con el permiso de avisos de siempre.
//   · Filas para la sección HOY de «Mis objetivos» (no añade nada al HUD).
// No entrega nada: todo lo decide el servidor (mensaje 'rit'). Lo de mundo.js llega por `c`.
import { EXPEDICION, DIARIA, premioDiaria } from '/mmo/js/data.js?v=379';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
const num = n => (Number(n) || 0).toLocaleString('es');
const LIMA_MS = 5 * 3600000, DIA_MS = 86400000, NOCHE_DESDE = 18, NOCHE_HASTA = 4;
const horaLima = (t = Date.now()) => new Date(t - LIMA_MS).getUTCHours();
const diaLima = (t = Date.now()) => Math.floor((t - LIMA_MS) / DIA_MS);
const esNoche = (t = Date.now()) => { const h = horaLima(t); return h >= NOCHE_DESDE || h < NOCHE_HASTA; };
const nocheId = (t = Date.now()) => (horaLima(t) >= NOCHE_DESDE ? diaLima(t) : horaLima(t) < NOCHE_HASTA ? diaLima(t) - 1 : null);
const faltaNoche = (t = Date.now()) => (esNoche(t) ? 0 : (diaLima(t) * DIA_MS + NOCHE_DESDE * 3600000) - (t - LIMA_MS));
const enHoras = ms => (ms >= 3600000 ? Math.ceil(ms / 3600000) + ' h' : Math.max(1, Math.ceil(ms / 60000)) + ' min');
const horaTxt = t => { try { return new Date(t).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
const ICO_INT = { xp: '⚔', oro: '🪙', pesca: '🎣' };

const CSS = `
.rt-v{width:min(460px,94vw);display:flex;flex-direction:column;overflow:hidden;max-height:calc(100vh - 16px - var(--tg-top,0px));max-height:calc(100dvh - 16px - var(--tg-top,0px));background:var(--panel);border:1px solid var(--marco);border-radius:12px;}
.rt-v h2{flex:none;font:700 15px var(--titulo);letter-spacing:.06em;font-variant:small-caps;color:var(--oro);text-align:center;margin:0 28px 10px;}
#rt-c{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;touch-action:pan-y;-webkit-overflow-scrolling:touch;font:500 13px/1.4 var(--sans);color:#fff;}
body.tgfs #v-rit.modal{padding-top:var(--tg-top,0px);}
.rt-sub{margin:0 0 10px;text-align:center;color:var(--txt2);font-size:12.5px;}
.rt-paso{margin:0 0 8px;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);}
.rt-paso>b{display:block;font:700 13px var(--sans);color:#fff;}
.rt-paso>b i{font-style:normal;color:var(--oro);margin-right:6px;}
.rt-paso small{display:block;margin-top:2px;color:var(--txt2);font-size:12px;line-height:1.35;}
.rt-paso.ok{border-color:rgba(74,222,128,.4);}
.rt-paso.ok>b{color:#86efac;}
.rt-ops{display:grid;gap:6px;margin-top:8px;}
.rt-op{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;min-height:44px;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;font:600 13px/1.3 var(--sans);text-align:left;cursor:pointer;touch-action:manipulation;}
.rt-op span{flex:none;width:22px;text-align:center;color:var(--oro);}
.rt-op small{display:block;margin:0;color:var(--txt2);font-weight:500;}
.rt-op[aria-pressed="true"]{border-color:var(--oro2);background:rgba(201,162,39,.2);box-shadow:inset 0 0 0 1px var(--oro2);}
.rt-op:focus-visible,.rt-v .btn:focus-visible,.rt-v select:focus-visible{outline:2px solid var(--oro);outline-offset:2px;}
.rt-v .btn{min-height:44px;}
.rt-prin{display:block;width:100%;margin:10px 0 0;}
.rt-prin[disabled]{opacity:.5;cursor:default;}
.rt-mini{margin-top:8px;padding:6px 12px;font-size:12.5px;min-height:38px;}
.rt-av{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;}
.rt-av label{display:block;font-size:12px;color:var(--txt2);}
.rt-av select{display:block;width:100%;min-height:44px;margin-top:3px;padding:6px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:#1b1236;color:#fff;font:600 13px var(--sans);}
.rt-log{display:flex;flex-wrap:wrap;gap:4px 12px;margin:6px 0 0;font-size:12.5px;}
.rt-log span b{color:var(--oro);}
#dq-rit{position:fixed;left:50%;top:calc(64px + env(safe-area-inset-top) + var(--tg-top,0px));transform:translateX(-50%);z-index:8;width:min(340px,calc(100vw - 32px));box-sizing:border-box;padding:12px 14px;border-radius:12px;border:1px solid var(--marco);background:var(--panel);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 6px 20px rgba(0,0,0,.45);color:#fff;font:500 13px/1.35 var(--sans);transition:opacity .3s ease;opacity:0;}
#dq-rit .rt-h{display:block;margin-bottom:4px;font:700 14px var(--titulo);letter-spacing:.06em;font-variant:small-caps;color:var(--oro);text-align:center;}
#dq-rit .rt-l{display:flex;gap:8px;align-items:flex-start;margin:5px 0;text-align:left;}
#dq-rit .rt-l>span{flex:none;width:18px;text-align:center;color:var(--oro);}
#dq-rit .rt-bs{display:flex;gap:6px;margin-top:8px;}
#dq-rit .rt-bs .btn{flex:1;min-width:0;min-height:44px;padding:8px;font-size:13px;}
#dq-rit .rt-bs .btn.sec{flex:0 0 auto;padding:8px 12px;}
body:is(.movil,.compacto) #dq-rit{top:var(--hud-fin,calc(110px + env(safe-area-inset-top) + var(--tg-top,0px)));}
@media (orientation:landscape) and (max-height:500px){body:is(.movil,.compacto) #dq-rit{left:calc(8px + env(safe-area-inset-left));transform:none;top:calc(70px + env(safe-area-inset-top) + var(--tg-top,0px));width:min(260px,40vw);max-height:calc(100vh - 78px);overflow-y:auto;padding:8px 10px;font-size:12px;}}
@media (prefers-reduced-motion:reduce){#dq-rit{transition:none;}}
`;

export function crearRituales(c) {
  const ID = 'v-rit';
  try { const st = document.createElement('style'); st.id = 'rt-css'; st.textContent = CSS; document.head.appendChild(st); } catch (e) {}
  let inf = null, cu = null, elegida = '', enviando = 0, cierre = null, tocaT = 0;
  let amVista = -1, amReintentos = 0, pedidoT = 0, marca = '';
  const yo = () => c.yo();
  const listo = () => !!(inf && inf.ab && yo() && yo().clase && !c.tutoActivo());
  const claveN = () => 'dq3_rit_n_' + ((yo() && yo().ck) || '');

  function pedir() { const n = Date.now(); if (n - pedidoT < 1500) return; pedidoT = n; try { c.mandar({ t: 'rit', a: 'info' }); } catch (e) {} }

  // ── Ventana ──
  function crearVentana() {
    if (cu) return;
    const m = document.createElement('div'); m.className = 'modal'; m.id = ID;
    m.innerHTML = '<div class="ventana rt-v" role="dialog" aria-labelledby="rt-t"><button class="bt cerrar" data-rt-cerrar aria-label="Cerrar">✕</button><h2 id="rt-t"></h2><div id="rt-c"></div></div>';
    document.body.appendChild(m);
    cu = m.querySelector('#rt-c');
    m.querySelector('[data-rt-cerrar]').onclick = () => c.cerrar(ID);
    m.addEventListener('pointerdown', () => { tocaT = Date.now(); }, { passive: true });
    cu.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-rt]'); if (!b) return; e.stopPropagation(); accionVentana(b.dataset); });
    cu.addEventListener('change', e => { if (e.target && e.target.matches && e.target.matches('select[data-av]')) guardarAviso(); });
    setInterval(() => { if (abierta() && Date.now() - tocaT > 900 && !cu.querySelector('select:focus')) pintar(); }, 1500);
  }
  const abierta = () => !!cu && document.getElementById(ID).classList.contains('on');
  function abrir() {
    crearVentana(); if (!yo()) return;
    quitarTarjeta(); pedir(); pintar(); c.abrir(ID); cu.scrollTop = 0;
  }

  function pasoExped() {
    const y = yo(), ex = y.exped, ahora = Date.now();
    if ((y.nivel || 1) < EXPEDICION.nv) return '';
    if (ex && ex.fin > ahora) return `<div class="rt-paso ok"><b><i>✓</i>Expedición en camino</b><small>Vuelve a las ${esc(horaTxt(ex.fin))} (hora de Perú) con oro y materiales.</small></div>`;
    if (ex) return `<div class="rt-paso"><b><i>🧭</i>Tu expedición ya volvió</b><small>Recoge el botín y mándala otra vez para la noche.</small><button type="button" class="btn sec rt-mini" data-rt="exr">Recoger y mandar de nuevo</button></div>`;
    return `<div class="rt-paso"><b><i>🧭</i>Expedición nocturna</b><small>${y.mascota ? 'Tu mascota' : 'Un duendecillo explorador'} sale 12 horas y vuelve por la mañana con oro y materiales.</small><button type="button" class="btn sec rt-mini" data-rt="exm">Mandar 12 h al Bosque</button> <button type="button" class="btn sec rt-mini" data-rt="exv">Elegir destino</button></div>`;
  }
  function seccionAviso() {
    const av = (inf && inf.av) || { m: null, n: null, con: 0, tg: 0 };
    const ops = (a, b, v) => '<option value="">No</option>' + Array.from({ length: b - a + 1 }, (_, i) => a + i).map(h => `<option value="${h}"${v === h ? ' selected' : ''}>${h}:00</option>`).join('');
    const alguno = av.m !== null || av.n !== null;
    let estado;
    if (!alguno) estado = 'Elige una hora y el bot te escribe por Telegram con lo que te espera. Como mucho un mensaje por la mañana y uno por la noche.';
    else if (av.con) estado = 'Activo. Como mucho un mensaje por franja, y solo si aún no hiciste lo de esa hora. Lo apagas aquí o con /avisos off en el bot.';
    else if (av.off) estado = 'Apagaste los avisos en el bot. Si quieres recibirlos, escribe /avisos on en @duendequest_bot.';
    else estado = 'Tu elección está guardada, pero falta tu permiso: sin él no te escribimos.';
    const pedirP = alguno && !av.con && !av.off;
    return `<div class="rt-paso"><b><i>🔔</i>Recordatorio por Telegram</b><div class="rt-av"><label>Por la mañana<select data-av="m" aria-label="Recordatorio por la mañana">${ops(5, 11, av.m)}</select></label><label>Por la noche<select data-av="n" aria-label="Recordatorio por la noche">${ops(18, 23, av.n)}</select></label></div><small>Hora de Perú. ${esc(estado)}</small>${pedirP ? '<button type="button" class="btn sec rt-mini" data-rt="permiso">Dar permiso de avisos</button>' : ''}</div>`;
  }
  function estadoDia() {
    let h = '';
    if (inf.am) h += `<div class="rt-paso"><b><i>☀</i>Amanecer sin recoger</b><small>+${num(inf.amPr.oro)} de oro y ${inf.amPr.pocion} poción${inf.olla && inf.olla.r ? ', más lo que reposó en la olla' : ''}.</small><button type="button" class="btn rt-mini" data-rt="am">Recibir</button></div>`;
    else h += '<div class="rt-paso ok"><b><i>✓</i>Amanecer recibido</b></div>';
    if (inf.int) { const o = inf.opc.find(x => x.k === inf.int.k) || {}; h += `<div class="rt-paso ok"><b><i>${ICO_INT[inf.int.k] || '✨'}</i>Intención de hoy: ${esc(o.nombre || '')}</b><small>${esc(o.txt || '')}. ${inf.int.q > 0 ? 'Te queda ' + num(inf.int.q) + ' de ' + num(inf.int.t) + '.' : 'Ya dio todo su fruto por hoy.'}</small></div>`; }
    if (inf.olla && !inf.am) h += inf.olla.r ? `<div class="rt-paso"><b><i>🥤</i>La olla ya reposó: ${inf.olla.r} ${inf.olla.r === 1 ? 'ración' : 'raciones'}</b><small>+${inf.olla.pr.pocion} pociones y +${num(inf.olla.pr.oro)} de oro.</small><button type="button" class="btn rt-mini" data-rt="olla">Recoger</button></div>` : `<div class="rt-paso"><b><i>🥤</i>La olla reposa</b><small>Lista en ${enHoras(inf.olla.ms - (Date.now() - inf._t))}. No se enfría: si faltas, te espera (hasta ${inf.olla.max} raciones).</small></div>`;
    return h;
  }
  function htmlCierre() {
    const k = cierre || {}, sig = inf.sig && inf.opc.find(x => x.k === inf.sig.k);
    const y = yo(), mn = c.textoManana ? c.textoManana() : '';
    const sinPunto = t => String(t || '').replace(/[.\s]+$/, '');
    const frases = ['El regalo del amanecer y la olla de Mama Asiri (2 pociones y oro)'];
    if (sig) frases.push('Tu intención: ' + sig.txt);
    if (y && y.exped && y.exped.fin > Date.now()) frases.push('Tu expedición vuelve a las ' + sinPunto(horaTxt(y.exped.fin)));
    if (mn) frases.push(sinPunto(mn));
    let h = '<p class="rt-sub">Día cerrado. Descansa: mañana el pueblo amanece contigo.</p>';
    h += `<div class="rt-paso ok"><b><i>✓</i>Lo de hoy</b><div class="rt-log"><span><b>${num(k.presas)}</b> ${k.presas === 1 ? 'presa' : 'presas'}</span>${k.niveles ? `<span><b>+${k.niveles}</b> ${k.niveles === 1 ? 'nivel' : 'niveles'}</span>` : ''}${k.misiones ? `<span><b>${k.misiones}</b> ${k.misiones === 1 ? 'misión' : 'misiones'} de la historia</span>` : ''}${k.diaria ? `<span>✓ ${esc(DIARIA.nombre)}</span>` : ''}</div>${c.gancho ? c.gancho() : ''}</div>`;
    h += `<div class="rt-paso"><b><i>☀</i>Mañana te espera</b><small>${esc(frases.join('. '))}.</small><small>Si mañana no puedes entrar, no pasa nada: la olla te espera hasta ${inf.olla ? inf.olla.max : 3} días y tu intención vale el día que vuelvas.</small></div>`;
    if (k.prot) h += '<div class="rt-paso ok"><b><i>🧿</i>Ganaste un protector de racha</b><small>Si un día faltas, tu racha diaria sigue como si hubieras entrado.</small></div>';
    else h += `<small class="rt-sub" style="display:block">Rituales hechos: ${num(inf.n)}. ${inf.prot === 1 ? 'El próximo te da' : 'En ' + inf.prot + ' más ganas'} un protector 🧿 de racha.</small>`;
    return h + pasoExped() + seccionAviso() + '<button type="button" class="btn rt-prin" data-rt="cerrar">Listo</button>';
  }
  function pintar() {
    if (!cu || !yo()) return;
    const tit = document.getElementById('rt-t');
    let h = '';
    if (!inf || !inf.ab) {
      tit.textContent = '🌙 Rituales del día';
      h = `<p class="rt-sub">${inf ? `Se abren a nivel ${inf.nv}: un regalo cada mañana y un ritual corto cada noche.` : 'Un momento…'}</p>`;
    } else if (esNoche() && inf.noche.hecho) {
      tit.textContent = '🌙 Buenas noches';
      h = htmlCierre();
    } else if (esNoche()) {
      tit.textContent = '🌙 Ritual de la noche';
      const pr = inf.olla && inf.olla.r ? ' Recoges también la de ayer.' : '';
      h = '<p class="rt-sub">Menos de un minuto. Lo que dejas esta noche te espera mañana.</p>' + pasoExped();
      h += `<div class="rt-paso"><b><i>🥤</i>La olla de Mama Asiri</b><small>Se queda al fuego al cerrar el día y amanece con 2 pociones y oro.${pr} Si faltas, te espera (hasta ${inf.olla ? inf.olla.max : 3} raciones).</small></div>`;
      h += '<div class="rt-paso"><b><i>✨</i>Tu intención para mañana</b><div class="rt-ops" role="group" aria-label="Intención para mañana">' + inf.opc.map(o => `<button type="button" class="rt-op" data-rt="int" data-k="${esc(o.k)}" aria-pressed="${elegida === o.k}"><span>${ICO_INT[o.k] || '✨'}</span><div>${esc(o.nombre)}<small>${esc(o.txt)}</small></div></button>`).join('') + '</div></div>';
      h += `<button type="button" class="btn rt-prin" data-rt="noche"${elegida && !enviando ? '' : ' disabled'}>${elegida ? 'Cerrar el día' : 'Elige una intención'}</button>` + seccionAviso();
    } else {
      tit.textContent = '☀ Rituales del día';
      h = estadoDia() + `<div class="rt-paso"><b><i>🌙</i>Ritual de la noche</b><small>Abre a las ${NOCHE_DESDE}:00, hora de Perú (en ${enHoras(faltaNoche())}): olla, expedición e intención para mañana, en menos de un minuto.</small></div>` + seccionAviso();
    }
    if (cu._h !== h) { cu.innerHTML = h; cu._h = h; }
  }
  function guardarAviso() {
    const v = k => { const s = cu.querySelector(`select[data-av="${k}"]`); return s && s.value !== '' ? +s.value : null; };
    c.mandar({ t: 'rit', a: 'aviso', m: v('m'), n: v('n') });
  }
  // El mismo permiso de siempre: en Telegram, la ventana del propio Telegram; en la web, «Avísame por Telegram».
  function pedirPermiso() {
    const tg = c.TG;
    if (tg && tg.requestWriteAccess) {
      try { tg.requestWriteAccess(ok => { if (ok) { c.mandar({ t: 'tgEscribir' }); setTimeout(() => { pedidoT = 0; pedir(); }, 1500); } else c.aviso('Sin tu permiso no te escribimos. Puedes darlo cuando quieras.', 'ok'); }); } catch (e) {}
      return;
    }
    c.cerrar(ID);
    if (c.pedirAvisoWeb) c.pedirAvisoWeb();
  }
  function accionVentana(d) {
    const a = d.rt;
    if (a === 'int') { elegida = d.k; cu._h = ''; pintar(); }
    else if (a === 'noche') { if (!elegida || enviando) return; enviando = Date.now(); setTimeout(() => { enviando = 0; }, 4000); c.mandar({ t: 'rit', a: 'noche', i: elegida }); }
    else if (a === 'am') c.mandar({ t: 'rit', a: 'am' });
    else if (a === 'olla') c.mandar({ t: 'rit', a: 'olla' });
    else if (a === 'exm') c.mandar({ t: 'exped', h: 12, d: 'bosque' });
    else if (a === 'exr') c.mandar({ t: 'exped', recoger: 1, repetir: 1 });
    else if (a === 'exv') { c.cerrar(ID); try { c.V.abrirExpedicion(); } catch (e) {} }
    else if (a === 'permiso') pedirPermiso();
    else if (a === 'cerrar') c.cerrar(ID);
  }

  // ── Tarjetas pequeñas (no bloquean; nunca en pelea ni con otra ventana) ──
  function quitarTarjeta() {
    const t = document.getElementById('dq-rit'); if (!t) return;
    clearTimeout(t._t); clearInterval(t._i);
    t.style.opacity = 0; t.id = ''; setTimeout(() => t.remove(), 320);
  }
  function tarjeta(titulo, lineas, botones, ms) {
    quitarTarjeta();
    const t = document.createElement('div');
    t.id = 'dq-rit'; t.setAttribute('role', 'dialog'); t.setAttribute('aria-label', titulo);
    t.innerHTML = `<b class="rt-h">${esc(titulo)}</b>${lineas.map(l => `<div class="rt-l"><span>${l[0]}</span><div>${l[1]}</div></div>`).join('')}<div class="rt-bs">${botones}</div>`;
    t.onclick = e => {
      const b = e.target.closest && e.target.closest('[data-rt]'); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      const a = b.dataset.rt; quitarTarjeta();
      if (a === 'am') c.mandar({ t: 'rit', a: 'am' });
      else if (a === 'ver') abrir();
      else if (a === 'luego') { try { localStorage.setItem(claveN(), String(nocheId())); } catch (er) {} }
    };
    for (const ev of ['pointerdown', 'touchstart', 'mousedown']) t.addEventListener(ev, e => e.stopPropagation(), { passive: true });
    document.body.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = 1; });
    t._t = setTimeout(quitarTarjeta, ms || 25000);
    // Si una pelea u otra tarjeta la quita antes de tocarla, el amanecer vuelve a salir mas tarde (dos veces como mucho).
    t._i = setInterval(() => { if (t.id && (c.peleando() || document.querySelector('#ob-sig,#dq-noche'))) { quitarTarjeta(); if (inf && inf.am && amReintentos < 2) { amReintentos++; amVista = -1; clearTimeout(revisar.t); revisar.t = setTimeout(revisar, 30000); } } }, 1000);
    try { c.sfx && c.sfx(); } catch (e) {}
  }
  const libre = () => { try { return !c.ocupado() && !abierta() && !document.querySelector('#dq-rit,#ob-sig,#dq-noche'); } catch (e) { return false; } };
  function tarjetaAmanecer() {
    const y = yo(), h = horaLima(), d = y.diaria || {}, L = [];
    // Lineas cortas (una sola en 360 px) y pocas en el celular: la tarjeta no baja hasta la zona del joystick.
    L.push(['🎁', `Amanecer: <b>+${num(inf.amPr.oro)} de oro</b> y ${inf.amPr.pocion} poción`]);
    if (inf.olla && inf.olla.r) L.push(['🥤', `Olla: <b>+${inf.olla.pr.pocion} pociones y +${num(inf.olla.pr.oro)} de oro</b>${inf.olla.r > 1 ? ` (${inf.olla.r} raciones)` : ''}`]);
    else if (inf.olla) L.push(['🥤', `La olla reposa: lista en ${enHoras(inf.olla.ms - (Date.now() - inf._t))}`]);
    if (inf.int) { const o = inf.opc.find(x => x.k === inf.int.k) || {}; L.push([ICO_INT[inf.int.k] || '✨', `Intención de hoy: <b>${esc(String(o.txt || '').split(' (')[0])}</b>`]); }
    if (y.exped && y.exped.fin <= Date.now()) L.push(['🧭', 'Tu expedición ya volvió con su botín']);
    if (!d.ok) { const pr = premioDiaria(y.nivel); L.push(['🎯', `${esc(DIARIA.nombre)} ${Math.min(d.p || 0, DIARIA.n)}/${DIARIA.n}: +${num(pr.oro)} de oro`]); }
    if (h < 19) L.push(['🌙', 'Hoy: Hora Feliz 20:00 · Gran Invasión 21:00']);
    const tope = document.body.classList.contains('movil') || document.body.classList.contains('compacto') ? 4 : 6;
    tarjeta(h < 12 ? '☀ Buenos días' : h < NOCHE_DESDE ? '☀ Buenas tardes' : '🌙 Buenas noches', L.slice(0, tope), '<button type="button" class="btn" data-rt="am">Recibir</button><button type="button" class="btn sec" data-rt="ver" aria-label="Ver los rituales del día">Ver</button>');
  }
  function tarjetaNoche() {
    tarjeta('🌙 Ritual de la noche', [['✨', 'Menos de un minuto: olla al fuego, expedición e intención para mañana.']], '<button type="button" class="btn" data-rt="ver">Hacer el ritual</button><button type="button" class="btn sec" data-rt="luego">Luego</button>');
  }
  // Una vez por minuto (y al llegar datos): lo que toca enseñar, si hay sitio.
  function revisar(intento) {
    if (!listo()) return;
    if (c.modoAnuncio && c.modoAnuncio()) return;
    const hoy = diaLima();
    if (inf.am && amVista !== hoy) {
      if (!libre()) { if ((intento || 0) < 60) { clearTimeout(revisar.t); revisar.t = setTimeout(() => revisar((intento || 0) + 1), 5000); } return; }
      amVista = hoy; tarjetaAmanecer(); return;
    }
    if (esNoche() && !inf.noche.hecho && !inf.am) {
      let ya = ''; try { ya = localStorage.getItem(claveN()) || ''; } catch (e) {}
      if (ya === String(nocheId())) return;
      if (!libre()) { if ((intento || 0) < 60) { clearTimeout(revisar.t); revisar.t = setTimeout(() => revisar((intento || 0) + 1), 5000); } return; }
      try { localStorage.setItem(claveN(), String(nocheId())); } catch (e) {}
      tarjetaNoche();
    }
  }
  // Cambio de día o de franja con el juego abierto: se piden los datos nuevos.
  setInterval(() => {
    if (!yo()) return;
    const mk = diaLima() + (esNoche() ? 'n' : 'd');
    if (marca && mk !== marca) { pedidoT = 0; pedir(); }
    marca = mk;
    if (inf && !document.hidden) revisar();
  }, 60000);

  function alMensaje(m) {
    if (!m) return;
    inf = m; inf._t = Date.now();
    if (m.gan && m.gan.a === 'noche') { cierre = m.cierre || {}; enviando = 0; }
    if (m.gan && m.gan.a === 'am') amVista = diaLima();
    if (m.avOk === 1) c.aviso(m.av && (m.av.m !== null || m.av.n !== null) ? (m.av.con ? '🔔 Recordatorio guardado' : '🔔 Guardado. Falta tu permiso de avisos') : '🔔 Sin recordatorios', 'ok');
    if (abierta()) { cu._h = ''; pintar(); if (m.gan && m.gan.a === 'noche') cu.scrollTop = 0; }
    clearTimeout(revisar.t); revisar.t = setTimeout(revisar, m.gan ? 20000 : 9000);
  }

  // ── Filas de la sección HOY de «Mis objetivos» ──
  function filasHoy() {
    if (!listo()) return '';
    const fila = (cuerpo, r, extra) => (r ? `<button type="button" class="ob-fila${extra ? ' ' + extra : ''}" data-a="rit" data-r="${r}">${cuerpo}</button>` : `<div class="ob-fila${extra ? ' ' + extra : ''}">${cuerpo}</div>`);
    let h = '';
    if (inf.am) h += fila(`<b>☀ Amanecer: recoge tu regalo</b><small>+${num(inf.amPr.oro)} de oro y ${inf.amPr.pocion} poción${inf.olla && inf.olla.r ? ' · y la olla, que ya reposó' : ''}</small>`, 'am', 'ob-prin');
    else h += fila('<b>✓ Amanecer recibido</b>', '', 'hecho');
    if (inf.int) { const o = inf.opc.find(x => x.k === inf.int.k) || {}; h += fila(`<b>${ICO_INT[inf.int.k] || '✨'} Intención de hoy: ${esc(o.nombre || '')}</b><small>${esc(o.txt || '')}${inf.int.q > 0 ? ' · te queda ' + num(inf.int.q) : ' · ya dio su fruto'}</small>`, '', inf.int.q > 0 ? '' : 'hecho'); }
    if (inf.olla && !inf.am) h += inf.olla.r ? fila(`<b>🥤 La olla ya reposó: ${inf.olla.r} ${inf.olla.r === 1 ? 'ración' : 'raciones'}</b><small>Toca para recoger +${inf.olla.pr.pocion} pociones y +${num(inf.olla.pr.oro)} de oro</small>`, 'olla') : fila(`<b>🥤 La olla de Mama Asiri reposa</b><small>Lista en ${enHoras(inf.olla.ms - (Date.now() - inf._t))}</small>`);
    if (esNoche()) h += inf.noche.hecho ? fila(`<b>✓ Ritual de la noche hecho</b><small>${inf.sig ? 'Mañana: ' + esc((inf.opc.find(x => x.k === inf.sig.k) || {}).txt || '') : 'Mañana te espera el amanecer'}</small>`, 'ver', 'hecho') : fila('<b>🌙 Ritual de la noche: listo</b><small>Menos de un minuto: olla, expedición e intención para mañana</small>', 'ver', 'ob-morado');
    else h += fila(`<b>🌙 Ritual de la noche</b><small>Abre a las ${NOCHE_DESDE}:00 (en ${enHoras(faltaNoche())}) · toca para elegir tu recordatorio</small>`, 'ver');
    return h;
  }
  function accion(r) {
    if (r === 'am') c.mandar({ t: 'rit', a: 'am' });
    else if (r === 'olla') c.mandar({ t: 'rit', a: 'olla' });
    else abrir();
  }

  const api = { pedir, alMensaje, filasHoy, accion, abrir, info: () => inf, estado: () => ({ listo: listo(), libre: libre(), noche: esNoche() }) };
  try { window.dqRit = api; } catch (e) {}   /* para el menu y las pruebas (tools/qa_rituales.mjs) */
  return api;
}
