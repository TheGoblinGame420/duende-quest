// ── BUZÓN "MIENTRAS NO ESTABAS" Y CELEBRACIÓN DE LA COMPRA ENTREGADA ──
// Lo usan los dos clientes (mmo/js/client.js y mundo/js/mundo.js). Crea su
// propio DOM y su CSS. El servidor (world.js: buzonAgregar / buzonEnviar)
// manda {t:'buzon', l:[{id,m,ts}]} y {t:'regalo', cod, nombre, skin, ala, oro, ya}
// al entrar; al cerrar la ventana se contesta {t:'visto', q} y el servidor lo vacia.
// Con dos pestañas no sale dos veces: lo ya visto se recuerda en este navegador.
//
// Uso:
//   const R = iniciarRegalo({ mandar, ocupado, presumir, fanfarria, vibrar, filtro });
//   en 'buzon': R.alBuzon(m)   en 'regalo': R.alRegalo(m)
// ocupado(): true mientras haya otra ventana (el cofre diario va primero).
import { SKINS, ALAS } from './data.js?v=332';

const CLAVE = 'dq_buzon_visto';
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function leerVistos() { try { const l = JSON.parse(localStorage.getItem(CLAVE) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
function marcarVisto(id) {
  try { const l = leerVistos().filter(x => x !== id); l.push(id); localStorage.setItem(CLAVE, JSON.stringify(l.slice(-60))); } catch (e) {}
}
function haceCuanto(ts) {
  const min = Math.max(0, Math.round((Date.now() - (ts || 0)) / 60000));
  if (min < 60) return min <= 1 ? 'hace un momento' : `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

const CSS = `
#dq-regalo{position:fixed;inset:0;z-index:10050;display:none;align-items:center;justify-content:center;background:rgba(5,4,12,.72);padding:16px;box-sizing:border-box;font-family:inherit;}
#dq-regalo.on{display:flex;}
#dq-regalo .rg-caja{position:relative;width:min(380px,100%);max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);overflow:auto;background:linear-gradient(180deg,#1d1730,#120e1f);border:1px solid rgba(255,216,74,.45);border-radius:18px;padding:20px 18px 16px;box-sizing:border-box;color:#f4f1ff;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.6),0 0 40px rgba(255,216,74,.18);animation:rg-in .45s cubic-bezier(.2,1.4,.4,1);}
#dq-regalo h2{margin:0 0 6px;font-size:20px;letter-spacing:.5px;color:#ffd84a;}
#dq-regalo .rg-p{margin:6px 0;font-size:14px;line-height:1.4;color:#ddd6fe;}
#dq-regalo .rg-fig{position:relative;width:180px;height:180px;margin:6px auto 4px;display:flex;align-items:center;justify-content:center;}
#dq-regalo .rg-rayos{position:absolute;inset:-30px;border-radius:50%;background:repeating-conic-gradient(rgba(255,216,74,.32) 0 10deg,transparent 10deg 30deg);animation:rg-gira 9s linear infinite;-webkit-mask:radial-gradient(circle,#000 30%,transparent 70%);mask:radial-gradient(circle,#000 30%,transparent 70%);}
#dq-regalo .rg-fig img{position:relative;max-width:150px;max-height:170px;image-rendering:pixelated;animation:rg-flota 2.4s ease-in-out infinite;}
#dq-regalo .rg-emo{position:relative;font-size:96px;line-height:1;animation:rg-flota 2.4s ease-in-out infinite;}
#dq-regalo .rg-chispa{position:absolute;top:50%;left:50%;width:7px;height:7px;border-radius:50%;background:#ffd84a;box-shadow:0 0 8px #ffd84a;opacity:0;animation:rg-chispa 1.6s ease-out infinite;}
#dq-regalo .rg-bots{display:flex;gap:8px;position:sticky;bottom:-16px;z-index:2;margin:14px -18px -16px;padding:10px 18px 16px;background:linear-gradient(rgba(18,14,31,0),#120e1f 14px);}
#dq-regalo button{flex:1;min-height:46px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#fff;font:inherit;font-weight:700;font-size:15px;cursor:pointer;touch-action:manipulation;}
#dq-regalo button.rg-si{background:linear-gradient(180deg,#ffd84a,#e0a810);color:#2a1a00;border-color:#ffd84a;}
#dq-regalo .rg-lista{text-align:left;margin:10px 0 0;padding:0;list-style:none;}
#dq-regalo .rg-lista li{padding:9px 10px;margin-bottom:6px;border-radius:10px;background:rgba(255,255,255,.06);font-size:13px;line-height:1.35;word-wrap:break-word;}
#dq-regalo .rg-lista small{display:block;margin-top:3px;color:#a5a0c0;font-size:11px;}
@keyframes rg-in{from{transform:scale(.7);opacity:0}to{transform:none;opacity:1}}
@keyframes rg-gira{to{transform:rotate(360deg)}}
@keyframes rg-flota{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes rg-chispa{0%{opacity:1;transform:translate(-50%,-50%) translate(0,0) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) translate(var(--dx),var(--dy)) scale(.3)}}
@media (prefers-reduced-motion:reduce){#dq-regalo *{animation:none!important}}
/* Movil en horizontal (360 px de alto): figura mas chica para que los botones se vean sin bajar;
   zona segura del notch en los cuatro lados; los botones quedan pegados abajo si hay que desplazar. */
#dq-regalo{padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));}
#dq-regalo .rg-caja{max-height:calc(100dvh - max(16px,env(safe-area-inset-top)) - max(16px,env(safe-area-inset-bottom)));}
@media (max-height:500px){
#dq-regalo{padding-top:max(8px,env(safe-area-inset-top));padding-bottom:max(8px,env(safe-area-inset-bottom));}
#dq-regalo .rg-caja{max-height:calc(100vh - 16px);max-height:calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom));padding-top:12px;}
#dq-regalo h2{font-size:17px;margin-bottom:2px;}
#dq-regalo .rg-fig{width:96px;height:96px;margin:2px auto 0;}
#dq-regalo .rg-rayos{inset:-14px;}
#dq-regalo .rg-fig img{max-width:84px;max-height:92px;}
#dq-regalo .rg-emo{font-size:56px;}
#dq-regalo .rg-p{margin:3px 0;}
}
`;

export function iniciarRegalo(H) {
  const cola = [];
  let abierto = null, raiz = null, intentos = 0, espera = 0;
  const vistos = new Set(leerVistos());

  function montar() {
    if (raiz) return raiz;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    raiz = document.createElement('div'); raiz.id = 'dq-regalo';
    raiz.innerHTML = '<div class="rg-caja" role="dialog" aria-modal="true"></div>';
    document.body.appendChild(raiz);
    addEventListener('keydown', e => { if (abierto && e.key === 'Escape') { e.stopPropagation(); cerrar(); } }, true);
    return raiz;
  }

  function cerrar() {
    if (!abierto) return;
    const a = abierto; abierto = null;
    raiz.classList.remove('on');
    if (a.tipo === 'buzon') { for (const x of a.l) { marcarVisto('b:' + x.id); vistos.add('b:' + x.id); } H.mandar({ t: 'visto', q: 'buzon' }); }
    else { marcarVisto('r:' + a.m.cod); vistos.add('r:' + a.m.cod); H.mandar({ t: 'visto', q: 'regalo' }); }
    setTimeout(intentar, 600);
  }

  // Espera a que no haya otra ventana (cofre diario, clase...); como mucho ~45 s.
  function intentar() {
    clearTimeout(espera);
    if (abierto || !cola.length) return;
    let ocupado = false;
    try { ocupado = !!(H.ocupado && H.ocupado()); } catch (e) {}
    if (ocupado && intentos < 30) { intentos++; espera = setTimeout(intentar, 1500); return; }
    intentos = 0;
    // Primero la compra (es lo que mas ilusion hace), luego el buzon.
    const i = cola.findIndex(x => x.tipo === 'regalo');
    mostrar(cola.splice(i >= 0 ? i : 0, 1)[0]);
  }

  function mostrar(a) {
    montar();
    abierto = a;
    const caja = raiz.querySelector('.rg-caja');
    if (a.tipo === 'buzon') {
      caja.innerHTML = `<h2>📬 MIENTRAS NO ESTABAS</h2><p class="rg-p">Esto pasó desde tu última visita:</p><ul class="rg-lista">${a.l.map(x => `<li>${esc(x.m)}<small>${haceCuanto(x.ts)}</small></li>`).join('')}</ul><div class="rg-bots"><button class="rg-si" data-rg="ok">Entendido</button></div>`;
    } else {
      const m = a.m, sk = m.skin && SKINS[m.skin], al = m.ala && ALAS[m.ala];
      const color = (sk && sk.color) || (al && al.color) || '#ffd84a';
      const fig = sk ? `<img src="/assets/skins/${esc(sk.img || 'skin_hero')}.png" alt="" onerror="this.replaceWith('🎁')" style="filter:drop-shadow(0 0 14px ${esc(color)})">` : `<span class="rg-emo">${al ? '🪽' : m.oro ? '🪙' : '🎁'}</span>`;
      let chispas = '';
      for (let i = 0; i < 14; i++) {
        const ang = i / 14 * Math.PI * 2, r = 80 + (i % 3) * 18;
        chispas += `<i class="rg-chispa" style="--dx:${Math.round(Math.cos(ang) * r)}px;--dy:${Math.round(Math.sin(ang) * r)}px;animation-delay:${(i % 5) * 0.28}s"></i>`;
      }
      const que = sk ? sk.nombre : al ? al.nombre : m.nombre;
      const extra = m.ya ? 'Ya la tenías: te devolvimos su precio en oro.' : sk ? 'Ya está en tus skins.' : al ? 'Ya las llevas puestas.' : '';
      const oro = m.oro ? ` +${Number(m.oro).toLocaleString('es', { useGrouping: 'always' })} oro.` : '';
      caja.innerHTML = `<h2>🎉 ¡TU COMPRA LLEGÓ!</h2><div class="rg-fig"><div class="rg-rayos"></div>${chispas}${fig}</div>
        <p class="rg-p" style="font-size:17px;color:#fff"><b style="color:${esc(color)}">${esc(que)}</b></p>
        <p class="rg-p">${esc(m.nombre)} ya es tuyo. ${esc(extra)}${esc(oro)}</p><p class="rg-p" style="font-size:12px;color:#a5a0c0">Gracias por apoyar DUENDE QUEST 💛</p>
        <div class="rg-bots">${sk ? '<button class="rg-si" data-rg="poner">¡Ponérmela!</button>' : '<button class="rg-si" data-rg="ok">¡Genial!</button>'}<button data-rg="presumir">Presumir</button></div>`;
      try { H.fanfarria && H.fanfarria(); } catch (e) {}
      try { H.vibrar && H.vibrar('success'); } catch (e) {}
    }
    caja.querySelectorAll('[data-rg]').forEach(b => b.onclick = () => {
      const q = b.dataset.rg, m = a.m;
      if (q === 'poner' && m && m.skin) H.mandar({ t: 'equipar', k: 'skin', id: m.skin });
      if (q === 'presumir' && m) { try { H.presumir && H.presumir(`¡Ya tengo ${(m.skin && SKINS[m.skin] && SKINS[m.skin].nombre) || m.nombre} en Duende Quest!`); } catch (e) {} }
      cerrar();
    });
    raiz.classList.add('on');
  }

  return {
    alBuzon(m) {
      const l = (Array.isArray(m.l) ? m.l : []).filter(x => x && x.id && !vistos.has('b:' + x.id) && !(H.filtro && H.filtro(x.m)));
      if (!l.length) { if (Array.isArray(m.l) && m.l.length) H.mandar({ t: 'visto', q: 'buzon' }); return; }
      if (cola.some(x => x.tipo === 'buzon') || (abierto && abierto.tipo === 'buzon')) return;
      cola.push({ tipo: 'buzon', l: l.slice(-10) });
      setTimeout(intentar, 1200);
    },
    alRegalo(m) {
      if (!m || !m.cod) return;
      if (vistos.has('r:' + m.cod)) { H.mandar({ t: 'visto', q: 'regalo' }); return; }
      if (cola.some(x => x.tipo === 'regalo' && x.m.cod === m.cod) || (abierto && abierto.m && abierto.m.cod === m.cod)) return;
      cola.push({ tipo: 'regalo', m });
      setTimeout(intentar, m.vivo ? 300 : 1500);
    },
    abierto: () => !!abierto,
  };
}
