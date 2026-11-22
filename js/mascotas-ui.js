// ═══════════════════════════════════════════════════════
// MASCOTAS MÍSTICAS — la ventana (CLASSIC y ORIGINS comparten este módulo)
//
// Solo pinta: recibe el catálogo (MASCOTAS, MISTICAS, RAREZAS_MASCOTA de
// mmo/js/data.js) y los datos del jugador que manda el servidor (yo.mascotas,
// yo.mascota, yo.huevo = { p, meta }). Los botones no deciden nada: piden
// equipar con el mensaje de siempre ({ t: 'comprar', k: 'mascota', id }) y el
// servidor valida (functions/mmo/mascotas.js). Los números de los bonos no
// están aquí: viven en functions/mmo/pets-config.js.
//
//   cuerpo.innerHTML = htmlMisticas({ yo, invitado, MASCOTAS, MISTICAS, RAREZAS });
//   cuerpo.addEventListener('click', e => clicMisticas(e, { equipar, cuenta }));
//
// Sin emojis como marca: CLASSIC los quita de sus ventanas (limpiarEmojis).
// ═══════════════════════════════════════════════════════
const CSS = `
.mm-huevo{display:flex;gap:14px;align-items:center;padding:12px 14px;margin:0 0 12px;border-radius:14px;background:linear-gradient(160deg,rgba(34,227,154,.14),rgba(245,200,76,.08));border:1px solid var(--border-gold,rgba(245,200,76,.38))}
.mm-huevo svg{flex:none;width:58px;height:72px;filter:drop-shadow(0 0 10px rgba(34,227,154,.55));animation:mm-mece 2.6s ease-in-out infinite;transform-origin:50% 92%}
.mm-huevo .mm-h-txt{flex:1;min-width:0}
.mm-huevo b{display:block;font:800 15px/1.25 var(--sans,system-ui,sans-serif);color:var(--accent,#f5c84c);margin:0 0 3px}
#mm-cuerpo .mm-huevo p{font:500 13px/1.4 var(--sans,system-ui,sans-serif);color:var(--text-2,#a9bdb3);margin:0 0 8px}
.mm-barra{height:12px;border-radius:99px;background:rgba(0,0,0,.45);border:1px solid var(--border,#213832);overflow:hidden;margin:0 0 4px}
.mm-barra i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#1ad68a,#6ff8c0 60%,#f5c84c);box-shadow:0 0 10px rgba(34,227,154,.6);transition:width .5s cubic-bezier(.2,1.4,.4,1)}
.mm-barra-t{font:700 12px var(--sans,system-ui,sans-serif);color:var(--text,#ecf7f1);margin:0 0 8px}
.mm-btn{appearance:none;cursor:pointer;min-height:40px;padding:8px 14px;border-radius:10px;font:800 13px var(--sans,system-ui,sans-serif);border:1px solid rgba(109,245,189,.55);background:var(--primary-strong,#0a8457);color:#fff;transition:transform .16s cubic-bezier(.2,1.6,.4,1),box-shadow .16s}
.mm-btn:hover{box-shadow:0 0 14px rgba(34,227,154,.45)}
.mm-btn:active{transform:scale(.94)}
.mm-btn.sec{background:transparent;color:var(--text,#ecf7f1);border-color:var(--border,#213832)}
.mm-btn.oro{background:linear-gradient(180deg,#ffe08a,#f5c84c);color:#1b1305;border-color:#f5c84c}
.mm-rejilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:10px}
.mm-ficha{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;padding:10px 10px 12px;border-radius:14px;background:var(--surface-2,#13201c);border:1px solid color-mix(in srgb,var(--rz) 55%,transparent);box-shadow:0 8px 22px -14px var(--rz);transition:transform .18s cubic-bezier(.2,1.5,.4,1),box-shadow .18s}
.mm-ficha:hover{transform:translateY(-3px);box-shadow:0 12px 26px -12px var(--rz)}
.mm-ficha.eq{border-color:var(--rz);box-shadow:0 0 0 1px var(--rz),0 10px 28px -10px var(--rz)}
.mm-img{position:relative;width:100%;aspect-ratio:1;max-width:132px;margin:0 0 6px;border-radius:12px;background:radial-gradient(circle at 50% 58%,color-mix(in srgb,var(--rz) 30%,transparent),transparent 68%)}
.mm-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;image-rendering:auto}
.mm-ficha.eq .mm-img img{animation:mm-flota 2.4s ease-in-out infinite}
.mm-ficha.no .mm-img img{filter:brightness(0) opacity(.5)}
.mm-rz{font:800 10px var(--sans,system-ui,sans-serif);letter-spacing:.08em;text-transform:uppercase;color:var(--rz);margin:0 0 2px}
.mm-ficha b{font:800 13px/1.25 var(--sans,system-ui,sans-serif);color:var(--text,#ecf7f1);margin:0 0 4px}
#mm-cuerpo .mm-bono{font:700 12px/1.3 var(--sans,system-ui,sans-serif);color:var(--primary-soft,#6df5bd);margin:0 0 4px}
#mm-cuerpo .mm-desc{font:500 11px/1.35 var(--sans,system-ui,sans-serif);color:var(--text-3,#7f958a);margin:0 0 8px;flex:1}
.mm-ficha .mm-btn{width:100%;min-height:36px;padding:6px 8px}
.mm-va{font:800 12px var(--sans,system-ui,sans-serif);color:var(--rz);margin:0 0 6px}
#mm-cuerpo .mm-nota{font:500 12px/1.45 var(--sans,system-ui,sans-serif);color:var(--text-3,#7f958a);margin:12px 0 0;text-align:center}
@keyframes mm-flota{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes mm-mece{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
@media (max-width:420px){.mm-rejilla{grid-template-columns:repeat(2,1fr);gap:8px}.mm-huevo{padding:10px}.mm-huevo svg{width:46px;height:58px}}
@media (prefers-reduced-motion:reduce){.mm-huevo svg,.mm-ficha.eq .mm-img img{animation:none}.mm-ficha,.mm-btn{transition:none}}
`;
function estilos() {
  if (document.getElementById('dq-mm-css')) return;
  const s = document.createElement('style'); s.id = 'dq-mm-css'; s.textContent = CSS;
  document.head.appendChild(s);
}
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// El huevo (esmeralda con vetas de oro): la cabecera de la ventana y el icono del botón.
const svgHuevo = id => '<svg viewBox="0 0 48 60" aria-hidden="true"><defs><radialGradient id="' + id + '" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="#b6ffe0"/><stop offset=".35" stop-color="#22e39a"/><stop offset=".8" stop-color="#0a8457"/><stop offset="1" stop-color="#064e3b"/></radialGradient></defs><path d="M24 2C13 2 4 20 4 36c0 13 9 22 20 22s20-9 20-22C44 20 35 2 24 2z" fill="url(#' + id + ')" stroke="#03150d" stroke-width="2"/><path d="M8 30c5-3 8 3 13 0s7-6 12-3 6 4 9 2M10 44c4-2 7 2 11 0s8-4 12-1 5 2 7 1" fill="none" stroke="#f5c84c" stroke-width="2" stroke-linecap="round"/><circle cx="17" cy="16" r="2" fill="#f5c84c"/><circle cx="31" cy="22" r="1.6" fill="#f5c84c"/><circle cx="26" cy="38" r="1.8" fill="#ffe08a"/><ellipse cx="16" cy="20" rx="4" ry="7" fill="#fff" opacity=".22" transform="rotate(-18 16 20)"/></svg>';
// El del botón de la barra lleva otro id de degradado: si el botón queda oculto (menú «⋯» del móvil), el de la ventana no se queda sin relleno.
export const HUEVO_SVG = svgHuevo('mm-hg-b');

// op: { yo, invitado, MASCOTAS, MISTICAS, RAREZAS }
export function htmlMisticas(op) {
  estilos();
  const { yo, invitado, MASCOTAS, MISTICAS, RAREZAS } = op;
  const y = yo || {};
  const tengo = new Set(y.mascotas || []), eq = y.mascota || '';
  const nTengo = MISTICAS.filter(id => tengo.has(id)).length;
  let h = '';
  if (invitado) {
    h += `<div class="mm-huevo">${svgHuevo('mm-hg-v')}<div class="mm-h-txt"><b>Tu Huevo Místico te espera</b><p>Crea tu cuenta gratis (solo correo y contraseña) y recibe un Huevo Místico de Duende. Tu duende de invitado pasa contigo, con todo lo que lleva.</p><button type="button" class="mm-btn oro" data-mm="cuenta">Crear mi cuenta gratis</button></div></div>`;
  } else if (y.huevo) {
    const p = Math.max(0, y.huevo.p | 0), meta = Math.max(1, y.huevo.meta | 0), pct = Math.min(100, Math.round(p * 100 / meta));
    const llevo = eq === 'huevo';
    h += `<div class="mm-huevo">${svgHuevo('mm-hg-v')}<div class="mm-h-txt"><b>Huevo Místico de Duende</b><div class="mm-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${meta}" aria-valuenow="${Math.min(p, meta)}"><i style="width:${pct}%"></i></div><div class="mm-barra-t">Incubación ${Math.min(p, meta)} / ${meta}</div><p>${llevo ? 'Lo llevas contigo: se incuba cuando cazas monstruos de tu nivel, vences jefes y entregas misiones.' : 'Solo se incuba si lo llevas contigo. Mientras llevas el huevo no tienes el bono de otra mascota.'}</p>${llevo ? '<button type="button" class="mm-btn sec" data-mm="guardar">Guardar el huevo</button>' : '<button type="button" class="mm-btn" data-mm="llevar" data-id="huevo">Llevar el huevo</button>'}</div></div>`;
  } else if (nTengo >= MISTICAS.length) {
    h += `<div class="mm-huevo">${svgHuevo('mm-hg-v')}<div class="mm-h-txt"><b>Colección completa</b><p>Ya nacieron tus ${MISTICAS.length} mascotas místicas. Elige cuál te acompaña.</p></div></div>`;
  }
  h += '<div class="mm-rejilla">';
  for (const id of MISTICAS) {
    const ma = MASCOTAS[id], rz = RAREZAS[ma.rareza] || { nombre: '', color: '#a9bdb3' };
    const mia = tengo.has(id), va = mia && eq === id;
    h += `<div class="mm-ficha${mia ? '' : ' no'}${va ? ' eq' : ''}" style="--rz:${rz.color}"><div class="mm-img"><img src="/assets/mascotas/${esc(ma.img)}.webp" alt="" loading="lazy" width="256" height="256"></div><div class="mm-rz">${esc(rz.nombre)}</div><b>${esc(ma.nombre)}</b><p class="mm-bono">${esc(ma.bono)}</p><p class="mm-desc">${mia ? esc(ma.desc) : 'Nace de un Huevo Místico.'}</p>${va ? '<div class="mm-va">Te acompaña</div><button type="button" class="mm-btn sec" data-mm="guardar">Guardar</button>' : mia ? `<button type="button" class="mm-btn" data-mm="llevar" data-id="${esc(id)}">Llevar</button>` : ''}</div>`;
  }
  h += '</div>';
  h += `<p class="mm-nota">Tienes ${nTengo} de ${MISTICAS.length}. Las mascotas místicas no se venden: nacen de un Huevo Místico. Solo te acompaña una a la vez y su bono lo calcula el servidor.</p>`;
  return h;
}
// Clic dentro de la ventana. op: { equipar(id), cuenta() }. Devuelve true si era un botón suyo.
export function clicMisticas(e, op) {
  const b = e.target && e.target.closest && e.target.closest('[data-mm]');
  if (!b) return false;
  const a = b.dataset.mm;
  if (a === 'llevar' && op.equipar) op.equipar(b.dataset.id || '');
  else if (a === 'guardar' && op.equipar) op.equipar('');
  else if (a === 'cuenta' && op.cuenta) op.cuenta();
  try { if (navigator.vibrate && matchMedia('(pointer: coarse)').matches) navigator.vibrate(10); } catch (er) {}
  return true;
}
