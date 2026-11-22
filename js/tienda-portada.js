// ═══════════════════════════════════════════════════════
// TIENDA DE LA PORTADA (index.html #nft-store): TODAS las skins del juego
//
// Antes eran 3 tarjetas escritas a mano (y con textos del arcade viejo).
// Ahora se pintan desde el catalogo unico (mmo/js/data.js SKINS: el mismo
// que usan CLASSIC, ORIGINS y el servidor), asi que una skin nueva aparece
// sola, con su precio real. Cada skin vale en los dos juegos: se ve en 3D
// (assets/skins/3d/<id>.webp, sacadas con tools/foto_taller.mjs) o en 2D.
//
// - data.js (~grande) se pide solo al acercarse a la tienda (lazy).
// - «Ya la tienes» / «En uso»: lo que el juego dejo en localStorage
//   (dq_mis_skins, anotarMisSkins en data.js). Solo es para mostrar; comprar
//   siempre pasa por la tienda del juego y la valida el servidor.
// - Precios: los de data.js tal cual (aqui no se calcula ninguno).
// - Si este modulo falla, quedan las tarjetas de siempre (data-skin-viejo).
// ═══════════════════════════════════════════════════════
const V = (document.querySelector('script[src*="tienda-portada.js"]') || {}).src?.match(/v=(\d+)/)?.[1] || '';
const RAREZAS = [
  ['comun', 'Común', '#a9bdb3'],
  ['rara', 'Rara', '#6df5bd'],
  ['epica', 'Épica', '#a78bfa'],
  ['legendaria', 'Legendaria', '#f2c14e'],
  ['mitica', 'Mítica', '#f472b6'],
];
const TIPOS = [['todas', 'Todas'], ['oro', 'Con oro'], ['disfraz', 'Disfraces'], ['premium', 'Animadas'], ['mias', 'Mías']];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const miles = n => Number(n).toLocaleString('es', { useGrouping: 'always' });

function rarezaDe(sk) {
  if (sk.premium) return 'mitica';
  const p = typeof sk.precio === 'number' ? sk.precio : 0;
  if (!p) return 'comun';
  if (p < 9000) return 'rara';
  if (p < 20000) return 'epica';
  return 'legendaria';
}
function misSkins() {
  try {
    const x = JSON.parse(localStorage.getItem('dq_mis_skins') || 'null');
    if (x && Array.isArray(x.s)) return { s: new Set(x.s.filter(k => typeof k === 'string')), k: String(x.k || '') };
  } catch (e) {}
  return null;
}

function estilos() {
  if (document.getElementById('tp-css')) return;
  const s = document.createElement('style');
  s.id = 'tp-css';
  s.textContent = `
.tp-filtros{display:flex;flex-direction:column;gap:.55rem;align-items:center;margin:-1rem auto 1.4rem;max-width:860px}
.tp-fila{display:flex;gap:.4rem;flex-wrap:wrap;justify-content:center}
.tp-chip{font:600 13px/1 var(--sans,system-ui);min-height:36px;padding:0 .85rem;border-radius:999px;border:1px solid var(--borde,#213832);background:transparent;color:var(--txt2,#a9bdb3);cursor:pointer}
.tp-chip[aria-pressed="true"]{color:var(--txt,#ecf7f1);border-color:var(--c,#6df5bd);background:color-mix(in srgb,var(--c,#6df5bd) 14%,transparent)}
.tp-chip:focus-visible{outline:2px solid var(--pri-txt,#6df5bd);outline-offset:2px}
.tp-vista{display:inline-flex;border:1px solid var(--borde,#213832);border-radius:999px;overflow:hidden}
.tp-vista .tp-chip{border:0;border-radius:0}
.tp-cuenta{font-size:12px;color:var(--txt3,#7f958a);text-align:center}
.nft-card.tp-skin{position:relative;--c:#a9bdb3;border-color:color-mix(in srgb,var(--c) 40%,transparent)}
.tp-img{width:96px;height:132px;object-fit:contain;image-rendering:auto;border-radius:12px}
.tp-img.v2d{border-radius:0}
.tp-img.v2d{width:96px;height:96px;margin:18px 0;image-rendering:pixelated}
.tp-skin .nft-badge{color:var(--c);border:1px solid color-mix(in srgb,var(--c) 45%,transparent)}
.tp-skin .nft-name{color:var(--c)}
.tp-tiene{position:absolute;top:.6rem;right:.6rem;font:700 11px var(--sans,system-ui);padding:.2rem .5rem;border-radius:999px;background:rgba(34,197,94,.15);color:#4ade80;border:1px solid rgba(34,197,94,.4)}
.tp-precio small{display:block;font-weight:500;font-size:12px;color:var(--txt3,#7f958a);margin-top:.15rem}
.tp-vacio{grid-column:1/-1;text-align:center;color:var(--txt2,#a9bdb3);padding:1.5rem}
@media (max-width:560px){
  #nft-store-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:.6rem}
  #nft-store-grid .nft-card{padding:.75rem .55rem;gap:.35rem}
  #nft-store-grid .nft-name{font-size:15px}
  #nft-store-grid .nft-desc{font-size:12px;line-height:1.4}
  #nft-store-grid .nft-price{font-size:14px;padding:.4rem .5rem}
  #nft-store-grid .nft-buy-btn{font-size:13px;padding:.45rem .4rem}
  .tp-img{width:80px;height:110px}.tp-img.v2d{width:80px;height:80px;margin:15px 0}
  .tp-tiene{top:.4rem;right:.4rem;font-size:10px}
  .tp-chip{min-height:34px;padding:0 .7rem;font-size:12px}
}`;
  document.head.appendChild(s);
}

async function montar() {
  const grid = document.getElementById('nft-store-grid');
  if (!grid || grid.dataset.tp) return;
  grid.dataset.tp = '1';
  let D;
  try { D = await import('/mmo/js/data.js' + (V ? '?v=' + V : '')); } catch (e) { grid.dataset.tp = ''; return; }
  const { SKINS, DISFRACES_SKIN, precioOro } = D;
  estilos();
  const mias = misSkins();
  const lista = Object.entries(SKINS).map(([id, sk]) => {
    const r = rarezaDe(sk);
    const tipo = sk.premium ? 'premium' : DISFRACES_SKIN.includes(id) ? 'disfraz' : 'oro';
    const oro = precioOro('skin', id);
    return { id, sk, r, tipo, oro, tiene: !!(mias && mias.s.has(id)), usa: !!(mias && mias.k === id) };
  }).sort((a, b) => RAREZAS.findIndex(x => x[0] === a.r) - RAREZAS.findIndex(x => x[0] === b.r) || (a.oro || 0) - (b.oro || 0) || (a.sk.usd || 0) - (b.sk.usd || 0));

  const filtros = document.createElement('div');
  filtros.className = 'tp-filtros';
  filtros.setAttribute('aria-label', 'Filtros de skins');
  filtros.innerHTML =
    '<div class="tp-fila" data-g="t">' + TIPOS.filter(([k]) => k !== 'mias' || mias).map(([k, n], i) => `<button type="button" class="tp-chip" data-v="${k}" aria-pressed="${i ? 'false' : 'true'}">${n}</button>`).join('') + '</div>'
    + '<div class="tp-fila" data-g="r"><button type="button" class="tp-chip" data-v="todas" aria-pressed="true">Toda rareza</button>' + RAREZAS.map(([k, n, c]) => `<button type="button" class="tp-chip" data-v="${k}" style="--c:${c}" aria-pressed="false">${n}</button>`).join('') + '</div>'
    + '<div class="tp-fila"><span class="tp-vista" role="group" aria-label="Vista previa"><button type="button" class="tp-chip" data-vista="3d" aria-pressed="true">Vista 3D</button><button type="button" class="tp-chip" data-vista="2d" aria-pressed="false">Vista 2D</button></span></div>'
    + '<p class="tp-cuenta" aria-live="polite"></p>';
  grid.parentNode.insertBefore(filtros, grid);

  const tarjeta = x => {
    const [, nR, cR] = RAREZAS.find(r => r[0] === x.r);
    const sk = x.sk;
    const f2 = sk.anim ? `hue-rotate(${sk.hue | 0}deg) saturate(${Number(sk.sat) || 1})` : '';   // las animadas son el duende base teñido
    let precio;
    if (sk.premium) precio = `US$${sk.usd}<small>Animada, solo con pago<span class="solo-cripto"> (Stars, SOL o $DUENDE)</span></small>`;
    else if (!x.oro) precio = 'Gratis<small>La tienes desde el inicio</small>';
    else precio = `${miles(x.oro)} oro${sk.usd ? `<small>o US$${sk.usd}</small>` : '<small>Solo con oro del juego</small>'}`;
    const acc = x.tiene ? 'Equípala en el juego' : !x.oro && !sk.premium ? 'Jugar gratis' : 'Conseguir en el juego';
    return `<div class="nft-card tp-skin" data-cat="skin" data-r="${x.r}" data-t="${x.tipo}"${x.tiene ? ' data-mia="1"' : ''} style="--c:${cR}">`
      + (x.tiene ? `<span class="tp-tiene">${x.usa ? 'En uso' : 'Ya la tienes'}</span>` : '')
      + `<img class="nft-img tp-img" data-3d="/assets/skins/3d/${esc(x.id)}.webp" data-2d="/assets/skins/${esc(sk.img)}.png" data-f2="${esc(f2)}" src="/assets/skins/3d/${esc(x.id)}.webp" alt="Skin ${esc(sk.nombre)} en 3D" width="96" height="132" loading="lazy" decoding="async">`
      + `<span class="nft-badge">${nR.toUpperCase()}</span>`
      + `<h3 class="nft-name">${esc(sk.nombre)}</h3>`
      + `<div class="nft-desc">${esc(sk.desc || '')}. Vale en CLASSIC 2D y ORIGINS 3D.</div>`
      + `<div class="nft-price tp-precio">${precio}</div>`
      + `<a class="nft-buy-btn${!x.oro && !sk.premium ? ' free' : ''}" href="${!x.oro && !sk.premium ? '/jugar/?web=1' : '/mundo/#premium'}">${acc}</a>`
      + '</div>';
  };
  grid.querySelectorAll('.nft-card[data-cat="skin"]').forEach(c => c.remove());
  grid.insertAdjacentHTML('afterbegin', lista.map(tarjeta).join('') + '<p class="tp-vacio" hidden>Ninguna skin con ese filtro.</p>'
    + `<button type="button" class="tp-chip tp-mas" hidden style="grid-column:1/-1;justify-self:center;min-height:44px">Ver las ${lista.length} skins</button>`);

  // Celular sin filtros: las 6 primeras y «Ver las N skins» (eran ~4.000 px de tarjetas).
  const estado = { t: 'todas', r: 'todas', todo: false };
  const corto = matchMedia('(max-width:560px)');
  const mas = grid.querySelector('.tp-mas');
  mas.addEventListener('click', () => { estado.todo = true; aplicar(); });
  const cuenta = filtros.querySelector('.tp-cuenta');
  const aplicar = () => {
    // La pestaña de arriba (Todo/Skins/Armas/Cofres) sigue mandando: filterStore pone .hidden.
    let n = 0, vis = 0;
    const tope = !estado.todo && estado.t === 'todas' && estado.r === 'todas' && corto.matches ? 6 : Infinity;
    grid.querySelectorAll('.tp-skin').forEach(c => {
      const ok = (estado.t === 'todas' || (estado.t === 'mias' ? c.dataset.mia : c.dataset.t === estado.t)) && (estado.r === 'todas' || c.dataset.r === estado.r);
      if (ok) n++;
      const ver = ok && vis < tope;
      if (ver) vis++;
      c.style.display = ver ? '' : 'none';
    });
    grid.querySelector('.tp-vacio').hidden = n > 0;
    mas.hidden = vis >= n;
    cuenta.textContent = `${n} de ${lista.length} skins` + (mias ? ` · tienes ${lista.filter(x => x.tiene).length}` : '');
  };
  corto.addEventListener && corto.addEventListener('change', aplicar);
  // Pestañas Armas / Cofres: sin filtros de skins ni «Ver las N».
  const filterStore0 = window.filterStore;
  if (typeof filterStore0 === 'function') window.filterStore = (cat, btn) => {
    filterStore0(cat, btn);
    const sinSkins = cat !== 'all' && cat !== 'skin';
    filtros.hidden = sinSkins;
    mas.style.display = sinSkins ? 'none' : '';
  };
  filtros.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.vista) {
      filtros.querySelectorAll('[data-vista]').forEach(o => o.setAttribute('aria-pressed', String(o === b)));
      const d2 = b.dataset.vista === '2d';
      grid.querySelectorAll('.tp-img').forEach(im => {
        im.src = d2 ? im.dataset['2d'] : im.dataset['3d'];
        im.classList.toggle('v2d', d2);
        im.style.filter = d2 ? im.dataset.f2 || '' : '';
        im.alt = im.alt.replace(/en [23]D$/, d2 ? 'en 2D' : 'en 3D');
      });
      return;
    }
    const g = b.parentNode.dataset.g;
    if (!g) return;
    estado[g] = b.dataset.v;
    b.parentNode.querySelectorAll('button').forEach(o => o.setAttribute('aria-pressed', String(o === b)));
    // Un filtro de skins con la pestaña en Armas o Cofres: se pasa a Skins.
    const tabSk = document.querySelector('.store-tab[onclick*="\'skin\'"]');
    const activa = document.querySelector('.store-tab.active');
    if (tabSk && activa && /'(weapon|chest)'/.test(activa.getAttribute('onclick') || '') && typeof window.filterStore === 'function') window.filterStore('skin', tabSk);
    aplicar();
  });
  aplicar();
}

const sec = document.getElementById('nft-store');
if (sec && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(e => { if (e.some(x => x.isIntersecting)) { io.disconnect(); montar(); } }, { rootMargin: '700px' });
  io.observe(sec);
} else montar();
