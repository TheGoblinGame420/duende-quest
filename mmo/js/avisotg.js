// ── «AVÍSAME POR TELEGRAM» PARA JUGADORES WEB E INVITADOS ──
// Lo usan los dos clientes (mmo/js/client.js y mundo/js/mundo.js). Crea su
// propio DOM y su CSS. El servidor (functions/mmo/retencion.js: ofrecerAvisoTg)
// manda {t:'avisoTg', cod, url, oro, ms, pedido} al cobrar el dia 2 de la racha
// o al entregar la mision 1 (solo a quien no juega con Telegram), y
// {t:'avisoTgOk', oro} cuando el jugador abrio el bot con ese enlace.
// El boton es un enlace normal (<a>): el movil no lo bloquea. Nada se envia
// por Telegram si el jugador no toca el boton y pulsa INICIAR en el bot.
//
// Uso:
//   const A = iniciarAvisoTg({ mandar, ocupado, aviso, tg });
//   en 'avisoTg': A.alOferta(m)   en 'avisoTgOk': A.alOk(m)
// ocupado(): true mientras haya otra ventana (la oferta espera, 10 min como mucho).
// tg: el Telegram.WebApp si se juega dentro de Telegram (abre el enlace con el).

const CLAVE_NO = 'dq_avtg_no';            // "Ahora no": no se vuelve a ofrecer en 7 dias
const PAUSA_NO = 7 * 86400000;
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function leerNo() { try { return Number(localStorage.getItem(CLAVE_NO)) || 0; } catch (e) { return 0; } }
function ponerNo() { try { localStorage.setItem(CLAVE_NO, String(Date.now())); } catch (e) {} }
const fmt = n => Math.round(n).toLocaleString('es', { useGrouping: 'always' });

// Jugadores de Telegram: permiso para que el bot les escriba (requestWriteAccess).
// Antes se pide con una tarjeta propia; 'dq_tg_escribir' = ya acepto,
// 'dq_tg_escribir_no' = fecha del «Ahora no» (se vuelve a preguntar a los 7 dias).
const CLAVE_ESC = 'dq_tg_escribir', CLAVE_ESC_NO = 'dq_tg_escribir_no';
export function escribirTgPendiente() {
  try {
    if (localStorage.getItem(CLAVE_ESC)) return false;
    return Date.now() - (Number(localStorage.getItem(CLAVE_ESC_NO)) || 0) >= PAUSA_NO;
  } catch (e) { return false; }
}
function ponerEscNo() { try { localStorage.setItem(CLAVE_ESC_NO, String(Date.now())); } catch (e) {} }

const CSS = `
#dq-avtg{position:fixed;inset:0;z-index:10040;display:none;align-items:center;justify-content:center;background:rgba(5,4,12,.66);padding:16px;box-sizing:border-box;font-family:inherit;}
#dq-avtg.on{display:flex;}
#dq-avtg .av-caja{width:min(360px,100%);max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);overflow:auto;background:linear-gradient(180deg,#16233a,#0e1424);border:1px solid rgba(84,169,235,.55);border-radius:18px;padding:18px 16px 14px;box-sizing:border-box;color:#f1f6ff;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.6);animation:av-in .35s cubic-bezier(.2,1.3,.4,1);}
#dq-avtg h2{margin:0 0 8px;font-size:19px;color:#7cc4ff;}
#dq-avtg .av-p{margin:6px 0;font-size:14px;line-height:1.4;color:#d6e4f7;}
#dq-avtg .av-oro{display:inline-block;margin:6px 0 2px;padding:4px 10px;border-radius:999px;background:rgba(255,216,74,.14);color:#ffd84a;font-weight:700;font-size:14px;}
#dq-avtg .av-bots{display:flex;flex-direction:column;gap:8px;margin-top:14px;}
#dq-avtg a,#dq-avtg button{display:flex;align-items:center;justify-content:center;min-height:48px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#fff;font:inherit;font-weight:700;font-size:15px;cursor:pointer;text-decoration:none;touch-action:manipulation;box-sizing:border-box;padding:0 12px;}
#dq-avtg a.av-si,#dq-avtg button.av-si{background:linear-gradient(180deg,#3aa7ea,#1f7fc0);border-color:#54a9eb;}
#dq-avtg .av-chico{font-size:12px;color:#93a7c4;margin-top:8px;}
@keyframes av-in{from{transform:scale(.8);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){#dq-avtg *{animation:none!important}}
/* Zona segura del notch y movil en horizontal (360 px de alto): botones en fila para que se vean sin bajar */
#dq-avtg{padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));}
#dq-avtg .av-caja{max-height:calc(100dvh - max(16px,env(safe-area-inset-top)) - max(16px,env(safe-area-inset-bottom)));}
@media (max-height:500px){
#dq-avtg{padding-top:max(8px,env(safe-area-inset-top));padding-bottom:max(8px,env(safe-area-inset-bottom));}
#dq-avtg .av-caja{width:min(460px,100%);max-height:calc(100vh - 16px);max-height:calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom));padding-top:12px;}
#dq-avtg h2{font-size:17px;margin-bottom:4px;}
#dq-avtg .av-p{margin:4px 0;font-size:13px;}
#dq-avtg .av-bots{flex-direction:row;margin-top:10px;}
#dq-avtg .av-bots>*{flex:1;}
}
`;

export function iniciarAvisoTg(H) {
  let raiz = null, oferta = null, espera = 0, esperaHasta = 0, abierto = false, permiso = false;

  function montar() {
    if (raiz) return raiz;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    raiz = document.createElement('div'); raiz.id = 'dq-avtg';
    raiz.setAttribute('role', 'dialog'); raiz.setAttribute('aria-modal', 'true'); raiz.setAttribute('aria-labelledby', 'dq-avtg-t');
    raiz.addEventListener('click', e => { if (e.target === raiz) { if (permiso) ponerEscNo(); cerrar(); } });
    document.body.appendChild(raiz);
    return raiz;
  }
  function cerrar() { abierto = false; permiso = false; if (raiz) raiz.classList.remove('on'); }
  function caducado() { return !oferta || Date.now() > oferta.hasta - 15000; }

  function pintar(fase) {
    const r = montar(), o = oferta;
    permiso = false;
    const premio = o.oro ? `<div class="av-oro">🎁 +${fmt(o.oro)} oro al activarlo</div>` : '';
    if (fase === 'abierto') {
      r.innerHTML = `<div class="av-caja"><h2 id="dq-avtg-t">📲 Ya casi</h2>
        <p class="av-p">En el chat del bot pulsa <b>INICIAR</b> (o <b>Start</b>). Cuando quede activado te lo diremos aquí.</p>${premio}
        <div class="av-bots"><a class="av-si" href="${esc(o.url)}" target="_blank" rel="noopener">Abrir Telegram otra vez</a><button type="button" data-a="cerrar">Listo</button></div></div>`;
    } else {
      r.innerHTML = `<div class="av-caja"><h2 id="dq-avtg-t">🔔 ¿Te avisamos por Telegram?</h2>
        <p class="av-p">Te escribimos <b>como mucho una vez al día</b> si tu racha está por perderse, tienes premios sin cobrar o empieza un evento.</p>
        <p class="av-p">Solo tienes que abrir el chat del bot y pulsar <b>INICIAR</b>. Lo apagas cuando quieras con /avisos off.</p>${premio}
        <div class="av-bots"><a class="av-si" href="${esc(o.url)}" target="_blank" rel="noopener">Avísame por Telegram</a><button type="button" data-a="no">Ahora no</button></div>
        <div class="av-chico">Necesitas tener Telegram instalado.</div></div>`;
    }
    const a = r.querySelector('a.av-si');
    a.addEventListener('click', ev => {
      // Codigo caducado: se pide otro y el jugador vuelve a tocar.
      if (caducado()) { ev.preventDefault(); H.mandar({ t: 'avisoTgCod' }); a.textContent = 'Preparando el enlace…'; return; }
      if (H.tg && H.tg.openTelegramLink) { ev.preventDefault(); try { H.tg.openTelegramLink(o.url); } catch (e) { location.href = o.url; } }
      setTimeout(() => { if (abierto) pintar('abierto'); }, 400);
    });
    const b = r.querySelector('button');
    b.addEventListener('click', () => { if (b.dataset.a === 'no') ponerNo(); cerrar(); });
    r.classList.add('on'); abierto = true;
  }

  function intentar() {
    espera = 0;
    if (!oferta) return;
    let ocu = false; try { ocu = !!(H.ocupado && H.ocupado()); } catch (e) {}
    if ((ocu && !abierto) || permiso) {   // la tarjeta del permiso de Telegram no se pisa
      if (Date.now() < esperaHasta) espera = setTimeout(intentar, 1500);
      return;
    }
    pintar('oferta');
  }

  return {
    // Jugador dentro de Telegram: tarjeta previa. Solo «Sí, avísame» abre la ventana
    // de permiso de Telegram; si acepta, se avisa al servidor ({t:'tgEscribir'}).
    // No se envia ningun mensaje en ese momento. «Ahora no» (o tocar fuera) = 7 dias.
    // Devuelve true si la tarjeta se mostro.
    pedirPermiso() {
      const tg = H.tg;
      if (abierto || !tg || !tg.requestWriteAccess || !escribirTgPendiente()) return false;
      const r = montar();
      r.innerHTML = `<div class="av-caja"><h2 id="dq-avtg-t">🔔 ¿Te avisamos por Telegram?</h2>
        <p class="av-p">Te escribimos <b>como mucho 1 vez al día</b> si tu racha está por perderse o tienes premios sin cobrar.</p>
        <div class="av-oro">🎁 +300 oro la primera vez que lo activas</div>
        <div class="av-bots"><button type="button" class="av-si" data-a="si">Sí, avísame</button><button type="button" data-a="no">Ahora no</button></div>
        <div class="av-chico">Lo apagas cuando quieras con /avisos off en el bot.</div></div>`;
      r.querySelector('[data-a="si"]').addEventListener('click', () => {
        cerrar();
        try {
          tg.requestWriteAccess(ok => {
            if (ok) { try { localStorage.setItem(CLAVE_ESC, '1'); } catch (e) {} H.mandar({ t: 'tgEscribir' }); }
            else { ponerEscNo(); try { H.mandar({ t: 'tgEscribirNo' }); } catch (e) {} }
          });
        } catch (e) {}
      });
      r.querySelector('[data-a="no"]').addEventListener('click', () => { ponerEscNo(); try { H.mandar({ t: 'tgEscribirNo' }); } catch (e) {} cerrar(); });
      r.classList.add('on'); abierto = true; permiso = true;
      return true;
    },
    alOferta(m) {
      if (!m || !/^https:\/\/t\.me\/duendequest_bot\?start=av_[a-z0-9]{10}$/.test(m.url || '')) return;
      // Navegador de Facebook/Instagram/TikTok (llegan por anuncios): no sacarlo hacia t.me si no lo pidio.
      if (!m.pedido && !(H && H.tg) && /FBAN|FBAV|FB_IAB|Instagram|Messenger|TikTok|BytedanceWebview/i.test(navigator.userAgent || '')) return;
      // Ofrecida sola (no pedida): respeta el "Ahora no" de esta semana.
      if (!m.pedido && Date.now() - leerNo() < PAUSA_NO) return;
      if (!m.pedido && m.ya) return;
      oferta = { url: m.url, oro: Number(m.oro) || 0, hasta: Date.now() + (Number(m.ms) || 600000) };
      if (abierto && !permiso) { pintar('oferta'); return; }
      esperaHasta = Date.now() + 600000;   // espera a que termine la pelea; si el codigo caduca, el boton pide otro (avisoTgCod)
      if (espera) clearTimeout(espera);
      // Un respiro: llega junto al cofre diario o al premio de la mision.
      espera = setTimeout(intentar, 2500);
    },
    alOk(m) {
      cerrar(); oferta = null;
      if (espera) { clearTimeout(espera); espera = 0; }
      const oro = m && Number(m.oro) || 0;
      if (H.aviso) H.aviso('🔔 Avisos por Telegram activados' + (oro ? ': +' + fmt(oro) + ' oro' : '') + '. Los apagas con /avisos off en el bot.', 'ok');
    },
  };
}
