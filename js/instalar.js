// ═══════════════════════════════════════════════════════
// DUENDE QUEST — franja «Añadir a pantalla de inicio» dentro del juego
// La usan CLASSIC y ORIGINS. js/pwa.js decide si este navegador puede instalar
// (window.dqPuedeInstalar) y abre el diálogo (window.dqInstalar); aquí solo va
// CUÁNDO se ofrece: como mucho una vez al día, nunca tapando una ventana ni un
// combate, y al llegar con el enlace «Jugar en el navegador» de Telegram (forzar).
// op: { ocupado(): boolean, invitado: boolean, forzar: boolean, texto, top }
// ═══════════════════════════════════════════════════════
const hoyLima = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);

export function franjaInstalar(op = {}) {
  try {
    if (!window.dqPuedeInstalar || !window.dqPuedeInstalar() || document.getElementById('franja-inst')) return false;
    // iPhone: la app instalada guarda aparte y un invitado empezaría de cero. Con cuenta no pasa.
    if (op.invitado && /iphone|ipad|ipod/i.test(navigator.userAgent)) return false;
    const hoy = hoyLima();
    if (!op.forzar) { try { if (localStorage.getItem('dq_inst_ofrecido') === hoy) return false; } catch (e) {} }
    if (op.ocupado && op.ocupado()) {
      const n = op.n || 0;
      if (n < 40) setTimeout(() => franjaInstalar({ ...op, n: n + 1 }), 5000);
      return false;
    }
    try { localStorage.setItem('dq_inst_ofrecido', hoy); } catch (e) {}
    const f = document.createElement('div');
    f.id = 'franja-inst';
    f.setAttribute('role', 'status');
    f.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(' + (op.top || 64) + 'px + env(safe-area-inset-top));z-index:60;width:min(94vw,440px);display:flex;gap:8px;align-items:center;padding:8px 10px;border-radius:12px;background:rgba(12,24,20,.95);border:1px solid rgba(245,200,76,.5);color:#ecf7f1;font:600 12px/1.35 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.45)';
    const tx = document.createElement('span');
    tx.style.cssText = 'flex:1;min-width:0';
    tx.textContent = op.texto || 'Ten Duende Quest en tu pantalla de inicio: vuelve en un toque y no pierdas tu racha';
    const si = document.createElement('button');
    si.type = 'button'; si.textContent = 'Instalar';
    si.style.cssText = 'flex:none;min-height:40px;padding:7px 14px;border:0;border-radius:10px;background:linear-gradient(180deg,#6ff8c0,#1ad68a);color:#03150d;font:800 13px system-ui,sans-serif;white-space:nowrap;cursor:pointer';
    const x = document.createElement('button');
    x.type = 'button'; x.setAttribute('aria-label', 'Cerrar'); x.textContent = '×';
    x.style.cssText = 'flex:none;min-width:40px;min-height:40px;margin:-6px -6px -6px 0;background:none;border:0;color:#a9bdb3;font-size:20px;padding:0;cursor:pointer';
    // Mientras está puesta, la página puede apartar sus avisos (body.dq-franja-inst): en CLASSIC caían debajo.
    const quitar = () => { f.remove(); document.body.classList.remove('dq-franja-inst'); };
    si.onclick = () => { quitar(); if (window.dqInstalar) window.dqInstalar(); };
    x.onclick = quitar;
    f.append(tx, si, x);
    document.body.appendChild(f);
    document.body.classList.add('dq-franja-inst');
    setTimeout(quitar, op.forzar ? 40000 : 25000);
    return true;
  } catch (e) { return false; }
}
