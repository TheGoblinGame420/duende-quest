// ═══════════════════════════════════════════════════════
// MODO DIOS en ORIGINS (3D). Antes solo habia panel en CLASSIC (F2): el dueño que
// entraba por Telegram (que abre el 3D) no veia como activarlo.
// Quien es dios lo decide SOLO el servidor (functions/mmo/dios.js: ADMIN_TG_ID,
// cuentas vinculadas y MMO_ADMINS); aqui solo se pinta el panel si yo.dios y se
// mandan los mismos mensajes { t: 'dios', a } que en CLASSIC. En el 3D no hay
// viajes de mapa (tp, irA, traer): el servidor los rechaza (mundo3d.js).
// ═══════════════════════════════════════════════════════
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function iniciarDios3(H) {
  // H: { mandar, yo(), abrir(id), cerrar(id), aviso(t, k) }
  let D = null, tab = 'poderes';
  const caja = document.createElement('div');
  caja.className = 'modal'; caja.id = 'v-dios';
  caja.innerHTML = '<div class="ventana"><button class="bt cerrar" aria-label="Cerrar">✕</button><h2>MODO DIOS</h2><div id="dios3-c"></div></div>';
  document.body.appendChild(caja);
  caja.querySelector('.cerrar').onclick = () => H.cerrar('v-dios');
  caja.addEventListener('keydown', e => { if (e.key !== 'Escape') e.stopPropagation(); });
  const C = caja.querySelector('#dios3-c');
  const d = o => H.mandar({ t: 'dios', ...o });
  const refrescar = () => setTimeout(() => d({ a: 'estado' }), 400);
  const BT = 'class="btn sec" style="padding:6px 9px;font-size:12px"';
  const FILA = 'style="margin:6px 0;padding:8px;border-radius:8px;background:rgba(0,0,0,.3)"';

  function pintar() {
    if (!caja.classList.contains('on')) return;
    const yo = H.yo() || {}, M = yo.diosModo || {};
    const X = D || { jugadores: [], pedidos: [], bans: [], log: [] };
    const dueno = (X.nivel || yo.diosNv) !== 'mod';
    if (!dueno && tab === 'pedidos') tab = 'poderes';
    const pend = (X.pedidos || []).filter(x => x.estado !== 'esperando_pago').length;
    let h = '<div style="display:flex;gap:4px;flex-wrap:wrap;margin:4px 0 10px">' + [['poderes', '⚡ Poderes'], ['jugadores', '👥 Jugadores'], ['pedidos', '🛒 Pedidos (' + pend + ')'], ['mod', '⛔ Moderación']]
      .filter(([k]) => dueno || k !== 'pedidos')
      .map(([k, t]) => `<button class="btn ${tab === k ? '' : 'sec'}" data-t="${k}" style="padding:6px 10px;font-size:12px">${t}</button>`).join('') + '</div>';
    if (tab === 'poderes') {
      h += `<p class="vv-p" style="font-size:12px">Eres <b>${dueno ? 'dueño' : 'moderador'}</b>. Con un poder encendido no ganas mTON ni subes en el ranking.</p>`;
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0">'
        + [['inv', '🛡️ Invencible'], ['golpe', '💥 Golpe divino'], ['vel', '⚡ Velocidad x3']].filter(([k]) => dueno || k !== 'golpe')
          .map(([k, t]) => `<button class="btn ${M[k] ? '' : 'sec'}" data-m="${k}">${t}${M[k] ? ' ✓' : ''}</button>`).join('')
        + '<button class="btn sec" data-a="curar">✨ Curarme</button>'
        + (dueno ? '<button class="btn sec" data-a="mundial3" style="grid-column:1/-1">👹 Invocar jefe mundial</button>' : '') + '</div>';
      h += '<p class="vv-p" style="margin:10px 0 4px">📢 Anuncio a todo el servidor:</p><div style="display:flex;gap:6px"><input id="dios3-an" maxlength="200" placeholder="Mensaje" style="flex:1;min-width:0;padding:8px;border-radius:8px;border:1px solid #0a8457;background:#070c0b;color:#fff;font-size:14px"><button class="btn" data-a="anuncio">Enviar</button></div>';
      h += '<p class="vv-p" style="font-size:11px;margin-top:10px;opacity:.8">Las copias de seguridad y los viajes entre mapas 2D están en CLASSIC (F2).</p>';
    } else if (tab === 'jugadores') {
      h += `<p class="vv-p" style="font-size:12px">${X.jugadores.length} conectados</p>`;
      h += X.jugadores.map(j => {
        const libre = dueno || !j.gm;
        return `<div ${FILA}><b>${j.dn ? '👑 ' : j.gm ? '🛡 ' : ''}${esc(j.n)}</b>
          <span style="font-size:12px;opacity:.8">Nv ${j.lv} · ${j.tipo === 'inv' ? 'invitado' : j.tipo === 'tg' ? 'Telegram' : 'web'} · ${(j.oro || 0).toLocaleString('es')} oro${j.mute ? ' · 🔇' : ''}</span>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">${dueno ? `<button ${BT} data-j="oro" data-p="${j.p}">Oro</button>` : ''}${libre ? `<button ${BT} data-j="renombrar" data-p="${j.p}">Renombrar</button><button ${BT} data-j="silenciar" data-p="${j.p}">${j.mute ? 'Quitar silencio' : 'Silenciar'}</button><button ${BT} data-j="expulsar" data-p="${j.p}">Expulsar</button>` : ''}${(dueno ? j.dn : j.gm) ? '' : `<button class="btn" style="padding:6px 9px;font-size:12px;background:#b91c1c;border-color:#b91c1c" data-j="banear" data-p="${j.p}">Banear</button>`}</div></div>`;
      }).join('');
    } else if (tab === 'pedidos') {
      const est = { pagado: '💰 Pagado', por_verificar: '🔎 Por revisar', esperando_pago: '⏳ Esperando pago' };
      if (!X.pedidos.length) h += '<p class="vv-p">No hay compras pendientes.</p>';
      h += X.pedidos.slice().reverse().map(x => `<div ${FILA}>
        <b>#${esc(x.codigo)} · ${esc(x.nombre)}</b> <span style="font-size:12px;opacity:.8">($${esc(x.usd)}) · ${esc(x.jugador)}</span>
        <p style="font-size:12px;margin:4px 0">${est[x.estado] || esc(x.estado)} · ${esc(x.monto)} · ${x.cadena ? (x.cadena.ok ? '✅ visto en la cadena' : '❌ ' + esc(x.cadena.motivo)) : x.metodo === 'stars' ? '' : '⚠️ sin comprobar'}</p>
        ${x.estado !== 'esperando_pago' ? `<div style="display:flex;gap:6px"><button class="btn" data-p2="entregar" data-c="${esc(x.codigo)}">🎁 Entregar</button><button class="btn sec" data-p2="anular" data-c="${esc(x.codigo)}">Anular</button></div>` : ''}</div>`).join('');
    } else {
      h += '<p class="vv-p" style="margin:4px 0">⛔ Baneados</p>' + (X.bans.length ? X.bans.map(b => `<div style="display:flex;gap:6px;align-items:center;justify-content:space-between;font-size:12px;margin:4px 0"><span>${esc(b.n)} · ${b.hasta ? 'hasta ' + new Date(b.hasta).toLocaleString('es') : 'permanente'}${b.motivo ? ' · ' + esc(b.motivo) : ''}</span>${b.d && !dueno ? '' : `<button ${BT} data-b="${b.t}">Quitar</button>`}</div>`).join('') : '<p class="vv-p" style="font-size:12px">Nadie.</p>');
      h += '<p class="vv-p" style="margin:12px 0 4px">📜 Últimas acciones</p>' + (X.log.length ? X.log.slice().reverse().map(l => `<div style="font-size:12px;opacity:.8">${new Date(l.t).toLocaleTimeString('es')} · ${esc(l.de)}: ${esc(l.txt)}</div>`).join('') : '<p class="vv-p" style="font-size:12px">Sin acciones todavía.</p>');
    }
    C.innerHTML = h;
  }

  C.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const X = D || { jugadores: [] };
    if (b.dataset.t) { tab = b.dataset.t; d({ a: 'estado' }); pintar(); return; }
    if (b.dataset.m) { const yo = H.yo() || {}; d({ a: 'modo', k: b.dataset.m, v: !((yo.diosModo || {})[b.dataset.m]) }); return; }
    if (b.dataset.a === 'curar') return d({ a: 'curar' });
    if (b.dataset.a === 'mundial3') { if (confirm('¿Invocar ahora al jefe mundial en el mundo 3D?')) d({ a: 'mundial3' }); return; }
    if (b.dataset.a === 'anuncio') { const i = C.querySelector('#dios3-an'), v = i.value.trim(); if (v) { d({ a: 'anuncio', m: v }); i.value = ''; } return; }
    if (b.dataset.b) { d({ a: 'desbanear', t: +b.dataset.b }); return refrescar(); }
    if (b.dataset.p2) {
      const codigo = b.dataset.c;
      if (b.dataset.p2 === 'entregar' && confirm('¿Entregar el pedido #' + codigo + '? Revisa antes que el pago llegó a tu wallet.')) d({ a: 'entregar', codigo });
      if (b.dataset.p2 === 'anular') { const motivo = prompt('Motivo de la anulación (lo verá el jugador):', ''); if (motivo !== null) d({ a: 'anular', codigo, motivo }); }
      return refrescar();
    }
    if (b.dataset.j) {
      const a = b.dataset.j, p = +b.dataset.p, j = X.jugadores.find(x => x.p === p);
      if (!j) return;
      if (a === 'oro') {
        const n = prompt('Oro para ' + j.n + ' (negativo para quitar):', '10000'); if (!n) return;
        const v = n.replace(/[.\s]/g, '');
        if (!/^-?\d+$/.test(v)) return H.aviso('Escribe solo cifras enteras, sin comas.', 'err');
        if (confirm((+v < 0 ? '¿Quitar ' : '¿Dar ') + Math.abs(+v).toLocaleString('es') + ' oro a ' + j.n + '?')) d({ a, p, n: +v });
      } else if (a === 'renombrar') { const n = prompt('Nuevo nombre para ' + j.n + ':', j.n); if (n) d({ a, p, n }); }
      else if (a === 'silenciar') { const min = j.mute ? 0 : +prompt('¿Cuántos minutos silenciar a ' + j.n + '?', '30'); if (j.mute || min > 0) d({ a, p, min }); }
      else if (a === 'expulsar') { if (confirm('¿Expulsar a ' + j.n + '?')) d({ a, p, motivo: prompt('Motivo (opcional):', '') || '' }); }
      else if (a === 'banear') { const horas = prompt('¿Banear a ' + j.n + ' cuántas horas? (0 = para siempre)', '24'); if (horas !== null && confirm('¿Seguro que quieres banear a ' + j.n + '?')) d({ a, p, horas: +horas, motivo: prompt('Motivo:', '') || '' }); }
      refrescar();
    }
  });

  return {
    abrir() { const yo = H.yo(); if (!yo || !yo.dios) return; H.abrir('v-dios'); d({ a: 'estado' }); pintar(); },
    panel(m) { D = m; pintar(); },
    modo() { pintar(); },
  };
}
