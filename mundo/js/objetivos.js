// ── MIS OBJETIVOS (ORIGINS) ──
// Que nunca falte que hacer. Ventana de tres niveles que se abre de un toque desde
// la caja de misiones: AHORA (el siguiente paso con flecha y metros), HOY (diarias,
// cofres y eventos) y GRAN META (la chicha real de Nv 60 y el capitulo de la historia).
// Ademas, una tarjeta pequeña que no bloquea: al completar algo sugiere lo siguiente
// con un boton y, al terminar una mision, al volver o al salir, deja la intriga en el aire.
//
// No guarda nada en el servidor ni entrega nada: solo lee lo que ya existe y usa los
// mismos mensajes y ventanas del juego. Lo que depende de mundo.js llega por `c`.
//
// El premio real no cambia con la historia: 2 litros en Nv 60 con sus requisitos.
import { MISIONES, MONSTRUOS, MAPAS, CHICHA, mesChicha, DIARIA, premioDiaria, EXPEDICION, horaFelizTiempos, zonaDeNivel } from '/mmo/js/data.js?v=377';
import { SECUNDARIAS, secundariaDe } from '/mmo/js/secundarias.js?v=377';
import { encargosDe, ZONAS_ENC } from '/mmo/js/encargos3d.js?v=377';
import * as LORE from './lore.js?v=377';

const { CAPITULOS, capituloDe, LORE_ZONAS, LORE_MISIONES } = LORE;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
const num = n => (Number(n) || 0).toLocaleString('es');

// Objetivo y gancho de cada capitulo: lore.js (CAPITULOS_INTRIGA y ganchoActual). Con el
// namespace, si faltara algo el panel sigue sin esa linea y el juego no se rompe.
const intrigaDe = z => (LORE.CAPITULOS_INTRIGA || {})[z] || {};

// Antes lo recordado en el navegador iba por pid, que cambiaba en cada despliegue. Al estrenar la clave estable (yo.ck) se
// pasa lo que haya, una vez, y se borran las claves huerfanas. Un personaje recien creado no hereda nada de otro de este
// aparato, y de los capitulos solo pasa lo que ya alcanzo. Tutorial, talento y habilidad nueva no se pasan: quiza eran de otro.
const CLAVE_VIEJA = /^dq3_(?:(cap|obj_t|m1|muerteXP|abismo|habNueva|tuto|talPre)_[0-9a-f]{12}|vista_(.+)_[0-9a-f]{12}|jefevisto_[0-9a-f]{12}_(.+))$/;
export function migrarClavesViejas(y) {
  if (!y || !y.ck) return;
  try {
    const marca = 'dq3_mig_' + y.ck;
    if (localStorage.getItem(marca)) return;
    if ((y.mis && y.mis.i >= 1) || y.nivel >= 2 || y.kills > 0) {
      const nCap = capituloDe((y.mis && y.mis.i) || 0).n, kCap = 'dq3_cap_' + y.ck, kSal = 'dq3_obj_t_' + y.ck;
      const caps = new Set((localStorage.getItem(kCap) || '').split(',').filter(Boolean));
      let salida = +localStorage.getItem(kSal) || 0;
      for (const k of Object.keys(localStorage)) {
        const m = CLAVE_VIEJA.exec(k); if (!m) continue;
        if (m[1] === 'cap') for (const v of (localStorage.getItem(k) || '').split(',')) { const p = /^([eg])(\d+)c?$/.exec(v); if (p && (p[1] === 'e' ? +p[2] <= nCap : +p[2] < nCap)) caps.add(v); }
        else if (m[1] === 'obj_t') salida = Math.max(salida, +localStorage.getItem(k) || 0);
        else if (m[1] === 'm1' || m[1] === 'muerteXP' || m[1] === 'abismo') localStorage.setItem('dq3_' + m[1] + '_' + y.ck, '1');
        else if (m[2]) localStorage.setItem('dq3_vista_' + m[2] + '_' + y.ck, '1');
        else if (m[3]) localStorage.setItem('dq3_jefevisto_' + y.ck + '_' + m[3], '1');
        localStorage.removeItem(k);
      }
      if (caps.size) localStorage.setItem(kCap, [...caps].join(','));
      if (salida) localStorage.setItem(kSal, String(salida));
    }
    localStorage.setItem(marca, '1');
  } catch (e) {}
}

// El capitulo actual: numero, titulo, zona y por que mision del capitulo vas.
export function capituloActual(misI) {
  const i = +misI || 0, cap = capituloDe(i), sig = CAPITULOS[cap.n];
  const total = (sig ? sig.desde : MISIONES.length) - cap.desde;
  return { n: cap.n, titulo: cap.titulo, z: cap.z, k: Math.min(i - cap.desde + 1, total), total, fin: i >= MISIONES.length };
}
// El ultimo gancho ganado: nunca adelanta lo que aun no has vivido. x3 cumplida trae la
// carta y x4 el caso cerrado. Devuelve solo el texto; quien lo dice va en quienGancho.
export function ganchoDe(misI, sec) {
  try { return LORE.ganchoActual(misI, !!(sec || {})['x3:ok'], !!(sec || {})['x4:ok']) || { quien: '', texto: '' }; } catch (e) { return { quien: '', texto: '' }; }
}
export const htmlGancho = g => (g && g.texto ? `<p class="ob-gancho">${esc(g.texto)}${g.quien ? ` <small>— ${esc(g.quien)}</small>` : ''}</p>` : '');
// Lo reunido de la historia. Recetario y pistas salen de las misiones hechas: el numero
// nunca viene del texto, porque los veteranos pueden hacerlas en desorden.
export function contarHistoria(sec, enc) {
  const s = sec || {}, e = enc || {};
  const ingr = SECUNDARIAS.filter(q => q.ingr), pist = SECUNDARIAS.filter(q => q.pista);
  return {
    reliquias: Object.keys(LORE_ZONAS || {}).filter(z => e[z + ':jefe'] === true).length,
    recetario: ingr.filter(q => s[q.id + ':ok']).length, recetarioT: ingr.length,
    pistas: pist.filter(q => s[q.id + ':ok']).length, pistasT: pist.length,
    historias: SECUNDARIAS.filter(q => s[q.id + ':ok']).length, historiasT: SECUNDARIAS.length,
  };
}
// Camino a la chicha real: los mismos requisitos que revisa el servidor en chicha.js.
export function granMeta(y, invitado) {
  const ch = (y && y.chicha) || {}, nv = (y && y.nivel) || 1;
  const dias = ch.dj || 0, horas = Math.floor((ch.mj || 0) / 60), hMeta = Math.round(CHICHA.min60 / 60);
  const rec = (ch.rec || []).includes('nv60');
  // Lo que le falta de tiempo con el Nv 60 ya hecho: «3 días y 5 h» (vacío si ya lo cumple).
  const fd = Math.max(0, CHICHA.dias60 - dias), fh = Math.max(0, hMeta - horas);
  const falta = [fd ? fd + (fd === 1 ? ' día' : ' días') : '', fh ? fh + ' h' : ''].filter(Boolean).join(' y ');
  return {
    falta, nv, nvMeta: CHICHA.nv60, pct: Math.min(100, Math.round(nv / CHICHA.nv60 * 100)),
    dias, diasMeta: CHICHA.dias60, horas, hMeta, litros: CHICHA.litros60, rec, q: ch.q60 || null,
    tg: !invitado, listo: !rec && !invitado && nv >= CHICHA.nv60 && dias >= CHICHA.dias60 && horas >= hMeta,
  };
}
// El puesto en la cola: solo existe de verdad desde que se reclama.
export function textoCola(g) {
  if (g.q && g.q.p) return `Tu reclamo #${g.q.id}: puesto ${g.q.p} de ${g.q.n} en la revisión del equipo${g.q.cola && g.q.me ? ' · cupo lleno: envío estimado para ' + mesChicha(g.q.me) : g.q.me ? ' · cupo de ' + mesChicha(g.q.me) : ''}.`;
  if (g.q && g.q.estado === 'enviado') return '🎉 Tu chicha ya va en camino.';
  if (g.q && g.q.estado === 'rechazado') return 'El equipo no aprobó tu reclamo. Los detalles están en «Ver el premio».';
  if (!g.rec && g.nv >= g.nvMeta && g.tg && g.falta) return `Ya tienes el nivel. Para reclamar te falta jugar ${g.falta}.`;
  if (g.rec) return 'Ya reclamaste: coordina el envío por WhatsApp con tu código.';
  return `Puesto en la cola: lo recibes al reclamar. Se envían hasta ${CHICHA.mesMax60} premios de Nv ${CHICHA.nv60} al mes; si ese mes se llena, entras en cola y ves tu puesto y el mes estimado.`;
}

const CSS = `
.ob-v{width:min(500px,94vw);display:flex;flex-direction:column;overflow:hidden;max-height:calc(100vh - 16px - var(--tg-top,0px));max-height:calc(100dvh - 16px - var(--tg-top,0px));}
.ob-v h2{flex:none;}
#ob-c{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;touch-action:pan-y;-webkit-overflow-scrolling:touch;}
body.tgfs #v-obj.modal{padding-top:var(--tg-top,0px);}
.ob-sec{margin:0 0 12px;}
.ob-sec:last-child{margin-bottom:2px;}
.ob-t{display:flex;align-items:baseline;gap:6px;margin:0 0 6px;font:800 12px var(--sans);letter-spacing:.06em;color:#ffd84a;}
.ob-t small{font:500 11px var(--sans);letter-spacing:0;color:var(--txt2);}
.ob-fila{display:block;width:100%;box-sizing:border-box;text-align:left;margin:0 0 5px;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font:500 13px/1.35 var(--sans);overflow-wrap:anywhere;}
button.ob-fila{position:relative;padding-right:24px;cursor:pointer;touch-action:manipulation;min-height:38px;}
button.ob-fila::after{content:'▸';position:absolute;right:9px;top:50%;transform:translateY(-50%);color:var(--txt2);}
.ob-fila b{font-weight:700;}
.ob-fila small{display:block;color:var(--txt2);font-size:11.5px;line-height:1.35;margin-top:1px;}
.ob-fila.hecho{opacity:.62;}
.ob-fila.hecho b{color:#4ade80;}
.ob-prin{padding:10px;border-color:rgba(255,216,74,.55);background:rgba(255,216,74,.1);}
.ob-prin .ob-dir{display:inline-block;margin-top:3px;font-weight:800;font-size:15px;color:#ffd84a;}
.ob-prin i{display:block;margin-top:4px;font-size:12px;line-height:1.35;color:#e9d5ff;}
.ob-acc{display:block;width:100%;margin-top:8px;}
.ob-bs2{display:flex;gap:6px;margin-top:8px;}
.ob-bs2 .btn{flex:1;min-width:0;padding:7px 4px;font-size:12px;min-height:36px;}
.ob-barra{height:8px;margin:5px 0;border-radius:4px;background:rgba(0,0,0,.45);overflow:hidden;}
.ob-barra span{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#7c3aed,#c084fc);}
.ob-chips{display:flex;flex-wrap:wrap;gap:4px 10px;margin:4px 0;font-size:12px;color:#fff;}
.ob-morado{border-color:rgba(192,132,252,.45);background:rgba(124,58,237,.16);}
.ob-gancho,.ventana .ob-gancho{margin:5px 0;font:italic 600 13px/1.35 var(--sans);color:#fde68a;}
.ob-gancho small{display:inline;font:500 11px var(--sans);color:var(--txt2);}
.ob-cuenta{display:block;margin-top:4px;font-size:12px;color:#e9d5ff;}
#misiones .ob-btn{float:right;position:relative;width:24px;height:24px;margin:-2px -3px 1px 4px;padding:0;border-radius:7px;border:1px solid rgba(255,216,74,.6);background:rgba(255,216,74,.14);color:#fff;font-size:13px;line-height:22px;text-align:center;cursor:pointer;touch-action:manipulation;}
#misiones .ob-btn::after{content:'';position:absolute;inset:-5px;}
body:is(.movil,.compacto) #misiones:not(.abierto) .ob-btn{margin-right:10px;}
/* Movil plegado: la caja crece lo que ocupa el boton, para que la fila conserve flecha y metros. Con objetivo fijado no hay sitio: el boton sale al desplegar. */
body:is(.movil,.compacto) #misiones:not(.abierto):not(.con-tuto):has(>.ob-btn){width:calc(min(180px,50vw) + 38px);}
@media (orientation:landscape) and (max-height:500px){body:is(.movil,.compacto) #misiones:not(.abierto):not(.con-tuto):has(>.ob-btn){width:max(min(218px,calc(100vw - 354px)),calc(clamp(100px,26vw,200px) + 38px));}}
body:is(.movil,.compacto):has(#obj[style*="block"]) #misiones:not(.abierto) .ob-btn{display:none;}
#ob-sig{position:fixed;left:50%;top:calc(64px + env(safe-area-inset-top) + var(--tg-top,0px));transform:translateX(-50%);z-index:8;width:min(340px,calc(100vw - 24px));box-sizing:border-box;padding:10px 12px;border-radius:14px;border:1px solid rgba(255,216,74,.55);background:rgba(20,14,34,.93);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 6px 20px rgba(0,0,0,.45);color:#fff;font:500 13px/1.35 var(--sans);transition:opacity .25s ease;opacity:0;}
#ob-sig.salida{z-index:30;top:50%;transform:translate(-50%,-50%);}
#ob-sig .ob-h{display:block;color:#4ade80;font-weight:800;font-size:13.5px;}
#ob-sig.salida .ob-h,#ob-sig.vuelta .ob-h{color:#ffd84a;}
#ob-sig .ob-sg{margin:4px 0 0;overflow-wrap:anywhere;}
#ob-sig .ob-bs{display:flex;gap:6px;margin-top:8px;}
#ob-sig .ob-bs .btn{flex:1;min-width:0;padding:7px 8px;font-size:12.5px;min-height:36px;}
#ob-sig .ob-bs .ob-mini{flex:0 0 42px;padding:0;}
body:is(.movil,.compacto) #ob-sig:not(.salida){top:var(--hud-fin,calc(110px + env(safe-area-inset-top) + var(--tg-top,0px)));}
html body:is(.movil,.compacto):has(#ob-sig:not(.salida)) #presumir3{bottom:auto;top:min(calc(var(--av-top,224px) + 60px),calc(100vh - 232px));}
@media (orientation:landscape) and (max-height:500px){
 html body:is(.movil,.compacto):has(#ob-sig:not(.salida)) #presumir3{left:calc(256px + env(safe-area-inset-left) + min(320px,calc(100vw - 272px))/2);width:min(320px,calc(100vw - 272px));}   /* left es su centro: su animacion «latir» lleva translateX(-50%) */
 html body.mano-der:is(.movil,.compacto):has(#ob-sig:not(.salida)) #presumir3{left:calc(64px + env(safe-area-inset-left) + min(320px,calc(100vw - 328px))/2);width:min(320px,calc(100vw - 328px));}
 body:is(.movil,.compacto) #ob-sig:not(.salida){left:calc(8px + env(safe-area-inset-left));right:auto;transform:none;top:calc(70px + env(safe-area-inset-top) + var(--tg-top,0px));width:min(240px,38vw);max-height:calc(100vh - 78px - env(safe-area-inset-top) - var(--tg-top,0px));overflow-y:auto;padding:8px 10px;font-size:12px;}
 body.mano-der:is(.movil,.compacto) #ob-sig:not(.salida){left:auto;right:calc(8px + env(safe-area-inset-right));top:calc(92px + env(safe-area-inset-top) + var(--tg-top,0px));max-height:calc(100vh - 100px - env(safe-area-inset-top) - var(--tg-top,0px));}
 html body:is(.movil,.compacto):has(#ob-sig:not(.salida)) #avisos{left:auto;right:calc(8px + env(safe-area-inset-right));transform:none;width:min(460px,calc(100vw - 264px));}
 html body.mano-der:is(.movil,.compacto):has(#ob-sig:not(.salida)) #avisos{left:calc(8px + env(safe-area-inset-left));right:auto;}
 /* Con grupo, alas o ficha de otro jugador bajo el marco, la tarjeta va a su derecha y no los tapa; los avisos ceden ese ancho. */
 html body:not(.mano-der):is(.movil,.compacto):has(:is(#grupo3,#alas,#objp)[style*="block"]) #ob-sig:not(.salida){left:calc(200px + env(safe-area-inset-left));top:calc(48px + env(safe-area-inset-top) + var(--tg-top,0px));width:min(220px,calc(100vw - 420px));max-height:calc(100vh - 56px - env(safe-area-inset-top) - var(--tg-top,0px));}
 html body:not(.mano-der):is(.movil,.compacto):has(:is(#grupo3,#alas,#objp)[style*="block"]):has(#ob-sig:not(.salida)) #avisos{width:calc(100vw - 436px);}
 html body:is(.movil,.compacto):has(#ob-sig:not(.salida)) #presumir3{top:calc(var(--av-top,92px) + 56px);}
 html body:not(.mano-der):is(.movil,.compacto):has(:is(#grupo3,#alas,#objp)[style*="block"]):has(#ob-sig:not(.salida)) #presumir3{top:calc(173px + env(safe-area-inset-top) + var(--tg-top,0px));left:calc(335px + env(safe-area-inset-left));width:270px;}
}
@media (prefers-reduced-motion:reduce){#ob-sig{transition:none;}}
`;

export function crearObjetivos(c) {
  const ID = 'v-obj';
  try { const st0 = document.createElement('style'); st0.id = 'ob-css'; st0.textContent = CSS; document.head.appendChild(st0); } catch (e) {}
  let cu = null, tocaT = 0;
  function crearVentana() {
    if (cu) return;
    const m = document.createElement('div'); m.className = 'modal'; m.id = ID;
    m.innerHTML = '<div class="ventana ob-v"><button class="bt cerrar" data-ob-cerrar aria-label="Cerrar">✕</button><h2>🎯 MIS OBJETIVOS</h2><div id="ob-c"></div></div>';
    document.body.appendChild(m);
    cu = m.querySelector('#ob-c');
    m.querySelector('[data-ob-cerrar]').onclick = () => c.cerrar(ID);
    m.addEventListener('pointerdown', () => { tocaT = Date.now(); }, { passive: true });
    cu.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('[data-a]'); if (!b) return;
      e.stopPropagation(); hacer(b.dataset);
    });
    // Metros y cuentas atras al dia, sin repintar justo bajo el dedo (se perderia el toque).
    setInterval(() => { if (m.classList.contains('on') && Date.now() - tocaT > 700) pintar(); }, 1500);
  }
  const abierto = () => !!cu && document.getElementById(ID).classList.contains('on');
  function abrirPanel() {
    crearVentana(); if (!c.yo() || !c.yo().mis) return;
    c.pintarMisiones(); pintar(); c.abrir(ID);
    cu.scrollTop = 0;
  }
  // Tecla O: en el tutorial tampoco abre, como el boton, pero avisa: la linea de teclas la anuncia desde el principio.
  function alternar() { if (abierto()) c.cerrar(ID); else if (c.tutoActivo()) c.aviso('🎯 Tus objetivos se abren al entregar tu primera misión', 'ok'); else abrirPanel(); }

  // Una accion del panel o de la tarjeta: los mismos caminos que ya tiene el juego.
  function hacer(d) {
    if (abierto()) c.cerrar(ID);
    quitarTarjeta();
    const a = d.a;
    if (a === 'entregar') c.mandar({ t: 'mision' });
    else if (a === 'diaria') c.mandar({ t: 'mision', diaria: true });
    else if (a === 'destino') { c.ponerDestino(+d.x, +d.z); c.aviso('📍 ' + (d.txt || 'Destino marcado') + ': sigue la marca del minimapa', 'ok'); }
    else if (a === 'tarea') c.irTarea(+d.i);
    else if (a === 'exped') c.V.abrirExpedicion();
    else if (a === 'ttemp') c.V.abrirTiendaTemp();
    else if (a === 'chicha') c.verChicha();
    else if (a === 'cuenta') c.crearCuenta();
    else if (a === 'leyenda') c.verLeyenda();
    else if (a === 'receta') c.verReceta();
    else if (a === 'caso') c.verCaso();
    else if (a === 'rit') { if (c.ritual) c.ritual(d.r); }
    else if (a === 'panel') abrirPanel();
    else if (a === 'salir' && salirA) salirA();
  }
  const attr = o => Object.keys(o || {}).map(k => ` data-${k}="${esc(o[k])}"`).join('');

  // ── AHORA: un solo paso, el mas importante ──
  function pasoAhora() {
    const y = c.yo(), P = c.P();
    if (c.enCueva(P.x)) return { ico: '⛏', tit: 'Estás en la Cueva', det: c.cuevaHecha() ? 'Ya la completaste: sal por el portal de la entrada.' : 'Llega al trono y derrota al Rey Goblin. Esquiva el pisotón rojo.', acc: { l: 'Seguir ▸' } };
    if (c.enAbismo(P.x)) return { ico: '🌌', tit: 'Estás en el Abismo', det: 'Abate a la otra facción y a los élites para ganar puntos. Vuelves por el portal de tu bastión.', acc: { l: 'Seguir ▸' } };
    const q = MISIONES[y.mis.i], d = y.diaria || {};
    // Primero lo que se cobra de un toque: la invasion no debe esconder un premio ya ganado.
    if (q && y.mis.p >= q.n) return { ico: '📜', tit: `¡«${q.nombre}» lista!`, det: 'Cóbrala ahora: se entrega desde cualquier sitio.', acc: { l: 'Entregar misión', a: 'entregar' } };
    if (!d.ok && (d.p || 0) >= DIARIA.n) return { ico: '☀', tit: `¡${DIARIA.nombre} lista!`, det: 'Tu premio de hoy te espera.', acc: { l: 'Cobrar', a: 'diaria' } };
    // Una invasion muy por encima de su nivel no es su siguiente paso (sigue en HOY): no se manda a un novato a morir.
    const inv = c.invasion3(), nvInv = inv && (MAPAS[inv.zona] || {}).nv;
    if (inv && (y.nivel || 1) >= 3 && (!nvInv || (y.nivel || 1) >= nvInv[0] - 3)) {
      const zc = c.zonaPunto(inv.zona);
      return { ico: '⚔️', tit: inv.nombre || 'Invasión', det: `¡Defiende ${(MAPAS[inv.zona] || {}).nombre || 'la zona'}! Hay premios para quienes ayudan.`, dir: zc ? c.camino(zc.x, zc.z) : '', acc: zc ? { l: '📍 Marcar en el mapa', a: 'destino', x: zc.x, z: zc.z, txt: 'Invasión' } : { l: 'Seguir ▸' } };
    }
    if (y.nivel >= CHICHA.nv60 && !(((y.chicha || {}).rec) || []).includes('nv60')) {
      const g = granMeta(y, c.soyInvitado());
      if (g.listo) return { ico: '🥤', tit: `¡Reclama tus ${g.litros} litros de chicha!`, det: 'Cumpliste todo. Reclámalo y coordina el envío por WhatsApp con tu código.', acc: { l: '🥤 Reclamar', a: 'chicha' } };
    }
    if (q) {
      const mq = MONSTRUOS[q.tipo] || {}, m = c.metaMision();
      const pr = `${mq.nombre || q.tipo}: ${Math.min(y.mis.p, q.n)}/${q.n}`;
      const lore = LORE_MISIONES && LORE_MISIONES[y.mis.i];
      if (m && m.entreno) {
        const k = MONSTRUOS[m.k] || {};
        return { ico: '📜', tit: q.nombre, det: `${pr}. Aún es muy fuerte para ti: sube cazando ${k.nombre || 'monstruos'} en la luz amarilla, o invita a un amigo.`, dir: c.camino(m.x, m.z), lore, acc: { l: 'Seguir la luz ▸' } };
      }
      return { ico: '📜', tit: q.nombre, det: pr, dir: m ? c.camino(m.x, m.z) : '', lore, acc: { l: m ? 'Seguir la luz ▸' : 'Seguir ▸' } };
    }
    // Sin cadena de Tito: la siguiente historia, y si no, la mejor zona para seguir subiendo.
    const qs = secundariaCerca();
    if (qs) {
      const pt = c.puntoSec(qs);
      const vq = c.vistaSec ? c.vistaSec(qs) : qs;
      return { ico: '📖', tit: qs.nombre, det: `${vq.pide} · ${vq.quien}`, dir: pt ? c.camino(pt.x, pt.z) : '', acc: pt ? { l: '📍 Marcar en el mapa', a: 'destino', x: pt.x, z: pt.z, txt: qs.nombre } : { l: 'Seguir ▸' } };
    }
    if (y.nivel < CHICHA.nv60) {
      const zn = zonaDeNivel(y.nivel), zp = c.zonaPunto(zn);
      return { ico: '⚔', tit: `Sube a Nv ${y.nivel + 1}`, det: `Caza en ${(MAPAS[zn] || {}).nombre || 'tu zona'}: es la zona de tu nivel.`, dir: zp ? c.camino(zp.x, zp.z) : '', acc: zp ? { l: '📍 Marcar en el mapa', a: 'destino', x: zp.x, z: zp.z, txt: (MAPAS[zn] || {}).nombre } : { l: 'Seguir ▸' } };
    }
    return { ico: '🌌', tit: 'El Abismo te espera', det: 'Gana rango con tu facción y prepárate para el Asedio del Núcleo.', acc: { l: 'Seguir ▸' } };
  }
  // La secundaria de turno: la de esta zona o, si no tiene, la primera de otra zona.
  function secundariaCerca() {
    const y = c.yo(), s = c.secundarias(), zE = c.zonaEn();
    const aqui = ZONAS_ENC.includes(zE) ? secundariaDe(zE, s, y.nivel) : null;
    if (aqui) return aqui;
    for (const z of ZONAS_ENC) { const o = secundariaDe(z, s, y.nivel); if (o) return o; }
    return null;
  }
  function filaAcc(cuerpo, acc, extra) {
    const cl = 'ob-fila' + (extra ? ' ' + extra : '');
    return acc ? `<button type="button" class="${cl}"${attr(acc)}>${cuerpo}</button>` : `<div class="${cl}">${cuerpo}</div>`;
  }
  function secAhora() {
    const p = pasoAhora(), y = c.yo();
    let h = `<div class="ob-fila ob-prin"><b>${p.ico} ${esc(p.tit)}</b>${p.det ? `<small>${esc(p.det)}</small>` : ''}${p.dir ? `<span class="ob-dir">${esc(p.dir.replace(/^ · /, ''))}</span>` : ''}${p.lore ? `<i>${esc(p.lore)}</i>` : ''}`;
    const { l, ...d } = p.acc || {};
    if (l) h += `<button type="button" class="btn ob-acc"${attr(d.a ? d : { a: 'cerrar' })}>${esc(l)}</button>`;
    h += '</div>';
    // Tambien a mano: la historia de turno y el encargo de la zona.
    if (MISIONES[y.mis.i] && !c.enCueva(c.P().x) && !c.enAbismo(c.P().x)) {
      const qs = secundariaCerca();
      if (qs) {
        const pt = c.puntoSec(qs), p0 = Math.min(c.secundarias()[qs.id] || 0, qs.n), vq = c.vistaSec ? c.vistaSec(qs) : qs;
        h += filaAcc(`<b style="color:#f0abfc">📖 ${esc(qs.nombre)}</b><small>${esc(vq.pide)}${vq.pend ? '' : ` ${p0}/${qs.n}`} · ${esc(vq.quien)}${pt ? esc(c.camino(pt.x, pt.z)) : ''}</small>`, pt ? { a: 'destino', x: pt.x, z: pt.z, txt: qs.nombre } : null);
      }
      const zE = c.zonaEn();
      if (ZONAS_ENC.includes(zE) && MAPAS[zE]) {
        const enc = c.encargos(), L = encargosDe(zE, MAPAS, MONSTRUOS), hechos = L.filter(e => enc[e.id] === true).length, sig = L.find(e => enc[e.id] !== true);
        if (sig) {
          const me = sig.tipo === 'explorar' ? c.metaEnc() : null, txt = c.MOVIL ? sig.txt.replace(' (V)', ' (botón VOLAR)') : sig.txt;
          h += filaAcc(`<b style="color:#7dd3fc">🧭 Encargo ${hechos}/${L.length}</b><small>${esc(txt)}${sig.n > 1 ? ` ${enc[sig.id] || 0}/${sig.n}` : ''}${me ? esc(c.camino(me.x, me.z)) : ''}</small>`, me ? { a: 'destino', x: me.x, z: me.z, txt: 'Encargo' } : null);
        }
      }
    }
    return `<section class="ob-sec"><div class="ob-t">AHORA <small>tu siguiente paso</small></div>${h}</section>`;
  }

  // ── HOY: lo que vale la pena antes de cerrar el dia ──
  function secHoy() {
    const y = c.yo(), d = y.diaria || {}, T = y.tareas, ahora = Date.now();
    let h = '';
    try { if (c.filasRitual) h += c.filasRitual(); } catch (e) {}   /* rituales.js: amanecer, olla, intencion y ritual de la noche */
    for (const ev of eventosHoy()) h += ev;
    if (d.ok) {
      const msD = 86400000 - ((ahora - 5 * 3600000) % 86400000);
      h += `<div class="ob-fila hecho"><b>✓ ${esc(DIARIA.nombre)}</b><small>Nueva en ${Math.ceil(msD / 3600000)} h</small></div>`;
    } else if ((d.p || 0) >= DIARIA.n) {
      h += filaAcc(`<b>☀ ${esc(DIARIA.nombre)}: ¡lista!</b><small>Toca para cobrarla</small>`, { a: 'diaria' });
    } else {
      const pr = premioDiaria(y.nivel);
      h += `<div class="ob-fila"><b>☀ ${esc(DIARIA.nombre)} ${Math.min(d.p || 0, DIARIA.n)}/${DIARIA.n}</b><small>Monstruos de tu nivel · +${num(pr.oro)} oro y ${pr.pocion} pociones</small></div>`;
    }
    if (T && T.dia) {
      T.dia.l.forEach((t, i) => {
        h += t.ok ? `<div class="ob-fila hecho"><b>✓ ${esc(t.txt)}</b></div>`
          : filaAcc(`<b>🗓 ${esc(t.txt)} ${t.p}/${t.n}</b><small>Toca y te marco el camino</small>`, { a: 'tarea', i });
      });
      const hs = T.sem.l.filter(t => t.ok).length, pts = T.sem.pts || 0, cof = T.sem.cof || 0, sig = [4, 8, 12][cof] || 12;
      h += `<div class="ob-fila"><b>📦 Cofres de la semana ${Math.min(cof, 3)}/3</b><small>${cof >= 3 ? 'Los tres abiertos: vuelve el lunes' : `Puntos ${pts}/${sig} · +1 por misión del día y +1 por su bono`} · Misiones de la semana ${hs}/${T.sem.l.length}</small></div>`;
    }
    const cf = c.cofreCerca();
    if (cf) h += filaAcc(`<b>🧰 ${esc(cf.nombre)}</b><small>${esc(c.camino(cf.x, cf.z).replace(/^ · /, ''))}${cf.tipo === 'legendario' ? ' · en lo alto: ¡vuela!' : ''}</small>`, { a: 'destino', x: cf.x, z: cf.z, txt: cf.nombre });
    if (y.nivel >= EXPEDICION.nv) {
      const ex = y.exped, ms = ex ? ex.fin - ahora : 0;
      const tx = !ex ? 'Manda a tu mascota de expedición' : ms <= 0 ? '¡Volvió de la expedición! Recoge el botín' : `Expedición: vuelve en ${ms >= 3600000 ? Math.ceil(ms / 3600000) + ' h' : Math.max(1, Math.ceil(ms / 60000)) + ' min'}`;
      h += filaAcc(`<b>🧭 ${esc(tx)}</b>`, { a: 'exped' });
    }
    const mn = c.textoManana();
    if (mn) h += `<div class="ob-fila"><b style="color:#ffd84a">🎁 ${esc(mn)}</b></div>`;
    return `<section class="ob-sec"><div class="ob-t">HOY <small>premios y eventos</small></div>${h}</section>`;
  }
  function eventosHoy() {
    const y = c.yo(), out = [], ahora = Date.now();
    const inv = c.invasion3(), pre = c.invPre3(), as = c.asedio();
    if (inv) {
      const ms = Math.max(0, inv.ms - (ahora - inv.recibido));
      out.push(`<div class="ob-fila ob-morado"><b>⚔️ ${esc(inv.nombre || 'Invasión')}</b><small>${esc((MAPAS[inv.zona] || {}).nombre || '')} · quedan ${Math.ceil(ms / 60000)} min</small></div>`);
    } else if (pre) {
      out.push(`<div class="ob-fila ob-morado"><b>🥁 ${pre.gran ? 'GRAN Invasión' : 'Invasión'} en ${Math.max(1, Math.ceil((pre.hasta - ahora) / 60000))} min</b><small>${esc((MAPAS[pre.zona] || {}).nombre || '')}</small></div>`);
    } else if (y.nivel >= 3) {
      const lima = new Date(ahora - 5 * 3600e3), min = lima.getUTCHours() * 60 + lima.getUTCMinutes();
      const falta = 21 * 60 - min;
      if (falta > 0) out.push(`<div class="ob-fila"><b>🥁 Gran Invasión hoy a las 21:00</b><small>Hora de Perú · faltan ${falta >= 60 ? Math.floor(falta / 60) + ' h ' : ''}${falta % 60 ? falta % 60 + ' min' : ''}</small></div>`);
      else out.push('<div class="ob-fila hecho"><b>🥁 Gran Invasión</b><small>La próxima, mañana a las 21:00 (hora de Perú)</small></div>');
    }
    const hf = horaFelizTiempos();
    if (hf.activa) out.push(`<div class="ob-fila ob-morado"><b>⚡ ¡Hora Feliz activa!</b><small>Acaba en ${Math.max(1, Math.ceil(hf.acaba / 60000))} min</small></div>`);
    else if (hf.falta < 3 * 3600000) { const fm = Math.ceil(hf.falta / 60000); out.push(`<div class="ob-fila"><b>⚡ Hora Feliz en ${fm >= 60 ? Math.floor(fm / 60) + ' h ' : ''}${fm % 60 ? fm % 60 + ' min' : ''}</b></div>`); }
    if (as && as.activo && c.asedioAbierto()) out.push(`<div class="ob-fila ob-morado"><b>⚔ Asedio del Núcleo en marcha</b><small>Entra al Abismo por el portal del pueblo</small></div>`);
    try {
      const ef = c.estadoFiesta();
      if (ef) out.push(filaAcc(`<b style="color:${esc(ef.tp.color)}">${ef.tp.emoji} ${esc(ef.tp.nombre || 'Fiesta')} · Día ${ef.d + 1}${ef.ok ? ' ✓' : ''}</b><small>${ef.ok ? 'Hecho por hoy' : `${esc(ef.def.txt)} ${ef.p}/${ef.n}`}</small>`, { a: 'ttemp' }));
    } catch (e) {}
    return out;
  }

  // ── GRAN META: la chicha real y la historia ──
  function secMeta() {
    const y = c.yo(), g = granMeta(y, c.soyInvitado()), si = b => (b ? '✅' : '⬜');
    let h = `<div class="ob-fila ob-morado"><b style="color:#e9d5ff">🥤 ${g.q && g.q.estado === 'rechazado' ? `Reclamo de ${g.litros} L no aprobado` : g.rec ? `${g.litros} L de chicha morada reclamados ✓` : `${g.litros} litros de chicha morada real a tu casa`}</b>`;
    h += `<small style="color:#fff">Nivel ${g.nv} de ${g.nvMeta}</small><div class="ob-barra" role="progressbar" aria-valuenow="${g.pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${g.pct}%"></span></div>`;
    h += `<div class="ob-chips"><span>${si(g.nv >= g.nvMeta)} Nv ${g.nv}/${g.nvMeta}</span><span>${si(g.dias >= g.diasMeta)} Días ${Math.min(g.dias, g.diasMeta)}/${g.diasMeta}</span><span>${si(g.horas >= g.hMeta)} Horas ${Math.min(g.horas, g.hMeta)}/${g.hMeta}</span><span>${si(g.tg)} Cuenta real</span></div>`;
    h += `<small>${esc(textoCola(g))}</small><small>El equipo revisa cada reclamo · envíos solo en Perú · gratis, no hay que comprar nada.</small>`;
    if (!g.tg) h += `<small style="color:#fde68a">Como invitado tus cazas no suman puntos de chicha. Con una cuenta gratis sí suman, y tu duende pasa contigo.</small><button type="button" class="btn sec ob-acc" data-a="cuenta">📧 Crear cuenta gratis</button>`;
    h += `<button type="button" class="btn ${g.listo ? '' : 'sec'} ob-acc" data-a="chicha">${g.listo ? `🥤 Reclamar mis ${g.litros} litros` : '🥤 Ver el premio'}</button></div>`;
    const cap = capituloActual(y.mis.i), I = intrigaDe(cap.z), n = contarHistoria(c.secundarias(), c.encargos()), gancho = ganchoVivido();
    h += `<div class="ob-fila"><b style="color:#fde68a">📖 Capítulo ${cap.n}/${CAPITULOS.length}: ${esc(cap.titulo)}</b>`;
    h += `<small>${cap.fin ? 'La cadena de Tito está completa.' : `Misión ${cap.k}/${cap.total} del capítulo.`}${I.objetivo && !cap.fin ? ' ' + esc(I.objetivo) : ''}</small>`;
    h += htmlGancho(gancho);
    h += `<span class="ob-cuenta">🏺 Reliquias ${n.reliquias}/10${n.recetarioT ? ` · 🌽 Recetario ${n.recetario}/${n.recetarioT}` : ''}${n.pistasT ? ` · 🕵 Pistas ${n.pistas}/${n.pistasT}` : ''} · 📖 Historias ${n.historias}/${n.historiasT}</span>`;
    h += `<div class="ob-bs2"><button type="button" class="btn sec" data-a="receta">🥤 La Receta</button>${y.mis.i >= 1 || n.pistas ? '<button type="button" class="btn sec" data-a="caso">🕵 Cuaderno</button>' : ''}<button type="button" class="btn sec" data-a="leyenda">📜 Leyenda</button></div></div>`;
    return `<section class="ob-sec"><div class="ob-t">GRAN META <small>la chicha es de verdad</small></div>${h}</section>`;
  }
  function pintar() {
    if (!cu || !c.yo() || !c.yo().mis) return;
    let h = '';
    try { h = secAhora() + secHoy() + secMeta(); } catch (e) { c.reportar && c.reportar(e); return; }
    if (cu._h !== h) { cu.innerHTML = h; cu._h = h; }
  }

  // ── TARJETA DE "LO SIGUIENTE" ──
  // Pequeña y sin fondo: nunca tapa una pelea, una ventana ni un dialogo; se va sola a
  // los 11 s o al volver a pelear. Lo ultimo que pasa sustituye a lo que esperaba.
  // Tambien en modo anuncio: estas tarjetas solo llevan lore, oro y misiones, nada de cripto.
  let pend = null, pendT = 0, ultimaLeve = 0, salirA = null, salidaVista = false, ultimoGancho = '';
  // El gancho que ya se gano en esta partida. Quien llega con la cadena avanzada (partida anterior al arco) no vivio la
  // escena: no se le adelanta «Fui yo» ni «se llamaba Sami». Con la carta o el caso cerrado ya hizo el camino de las pistas.
  function ganchoVivido() {
    const y = c.yo(), s = c.secundarias(), i = (y && y.mis && y.mis.i) || 0;
    if (!s['x3:ok'] && !s['x4:ok']) {
      const ult = CAPITULOS.filter(x => i >= LORE.finCapitulo(x)).pop();
      if (ult && !c.capVisto('g' + ult.n)) return { quien: '', texto: '' };
    }
    return ganchoDe(i, s);
  }
  function quitarTarjeta() {
    const t = document.getElementById('ob-sig'); if (!t) return;
    clearTimeout(t._t); clearInterval(t._i);
    t.style.opacity = 0; t.id = ''; setTimeout(() => t.remove(), 280);
  }
  function tarjeta(cl, titulo, cuerpo, botones, ms) {
    crearVentana();
    quitarTarjeta();
    const t = document.createElement('div');
    t.id = 'ob-sig'; t.className = cl || ''; t.setAttribute('role', 'dialog'); t.setAttribute('aria-label', titulo);
    t.innerHTML = `<b class="ob-h">${esc(titulo)}</b>${cuerpo}<div class="ob-bs">${botones}</div>`;
    t.onclick = e => {
      const b = e.target.closest && e.target.closest('[data-a]'); if (!b) return;
      e.preventDefault(); e.stopPropagation(); hacer(b.dataset);
    };
    for (const ev of ['pointerdown', 'touchstart', 'mousedown']) t.addEventListener(ev, e => e.stopPropagation(), { passive: true });
    document.body.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = 1; });
    if (ms) {
      t._t = setTimeout(quitarTarjeta, ms);
      t._i = setInterval(() => { if (t.id && c.peleando()) quitarTarjeta(); }, 1000);
    }
    return t;
  }
  function botonesPaso(p) {
    const { l, ...d } = (p && p.acc) || {};
    return `<button type="button" class="btn"${attr(d.a ? d : { a: 'cerrar' })}>${esc(l || 'Seguir ▸')}</button><button type="button" class="btn sec ob-mini" data-a="panel" aria-label="Mis objetivos" title="Mis objetivos">🎯</button>`;
  }
  const lineaPaso = p => `<p class="ob-sg">➜ <b>${esc(p.tit)}</b>${p.dir ? ' ' + esc(p.dir) : ''}</p>`;
  function mostrarPend() {
    clearTimeout(pendT); pendT = 0;
    const o = pend; if (!o) return;
    if (!c.yo() || !c.yo().mis) { pend = null; return; }
    if (Date.now() > o.vence) { pend = null; return; }
    if (c.ocupado() || document.getElementById('ob-sig') || abierto()) { pendT = setTimeout(mostrarPend, 1500); return; }
    pend = null;
    c.pintarMisiones();
    const p = pasoAhora();
    // La misma frase no se repite tras cada mision del capitulo: sigue en el panel. «Donde lo dejaste» si la recuerda.
    let gancho = o.gancho ? ganchoVivido() : null;
    if (gancho && gancho.texto === ultimoGancho && o.cl !== 'vuelta') gancho = null;
    if (gancho && gancho.texto) ultimoGancho = gancho.texto;
    tarjeta(o.cl || '', o.titulo, (o.extra ? `<p class="ob-sg" style="color:#e9d5ff">${esc(o.extra)}</p>` : '') + htmlGancho(gancho) + lineaPaso(p), botonesPaso(p), 11000);
    try { c.sfx && c.sfx(); } catch (e) {}
  }
  // Algo se completo: titulo de lo hecho y boton con lo siguiente.
  // opc: { gancho: la intriga en dorado, leve: encargos y tareas, sin amontonar; extra; espera }.
  function sugerir(titulo, opc) {
    const o = opc || {};
    if (o.leve) {
      if (c.tutoActivo() || (pend && !pend.leve) || Date.now() - ultimaLeve < 90000) return;
      ultimaLeve = Date.now();
    }
    pend = { titulo: '✓ ' + titulo, gancho: !!o.gancho || !!(pend && pend.gancho), extra: o.extra || (pend && pend.extra) || '', leve: !!o.leve, vence: Date.now() + 75000 };
    clearTimeout(pendT);
    pendT = setTimeout(mostrarPend, o.espera || 4500);
  }
  // Una mision de la cadena cumplida: siempre con la intriga.
  function misionCumplida(iAntes) {
    const q = MISIONES[iAntes]; if (!q) return;
    // Al cerrar un capitulo la historia ya cuenta su gancho en dialogo: aqui no se repite.
    const cierra = capituloDe(iAntes + 1).n !== capituloDe(iAntes).n;
    sugerir('Misión cumplida: ' + q.nombre, { gancho: !cierra, espera: iAntes === 0 ? 9000 : 4500 });
  }
  // Una secundaria cumplida: si era ingrediente o pista, el conteo real (nunca del texto).
  function secundariaCumplida(q) {
    if (!q) return;
    const n = contarHistoria(c.secundarias(), c.encargos());
    const extra = q.pista && n.pistasT ? `🕵 Pistas del cuaderno: ${n.pistas}/${n.pistasT}` : q.ingr && n.recetarioT ? `🌽 Recetario: ${n.recetario}/${n.recetarioT}` : '';
    sugerir(q.nombre, { extra, gancho: !!q.pista });
  }
  // Al salir por ⌂ o por Atras: una tarjeta (una vez por sesion) con la intriga y lo de
  // mañana. Con una ventana abierta no se le pone encima: sale directo.
  function despedida(irse) {
    const y = c.yo();
    if (salidaVista || !y || !y.mis || !y.clase || c.tutoActivo() || document.querySelector('.modal.on, #tarjeta-bautizo')) return false;
    salidaVista = true; salirA = irse; pend = null;
    const gancho = ganchoVivido(), mn = c.textoManana();
    let p = null; try { c.pintarMisiones(); p = pasoAhora(); } catch (e) {}
    tarjeta('salida', '🌙 Hasta la próxima', `${htmlGancho(gancho)}${p ? `<p class="ob-sg">Te queda: <b>${esc(p.tit)}</b></p>` : ''}${mn ? `<p class="ob-sg">🎁 ${esc(mn)}</p>` : ''}`,
      '<button type="button" class="btn" data-a="cerrar">Seguir jugando</button><button type="button" class="btn sec" data-a="salir">Salir</button>', 0);
    return true;
  }
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    let ruta = ''; try { ruta = new URL(a.href, location.href).pathname; } catch (er) { return; }
    if (ruta !== '/inicio/' && ruta !== '/telegram/index.html') return;
    if (despedida(() => { location.href = a.href; })) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  // Al volver tras unas horas: donde quedo la historia y que sigue (una vez por visita).
  let entro = false;
  const claveVuelta = () => 'dq3_obj_t_' + ((c.yo() && (c.yo().ck || c.yo().pid)) || '');
  function guardarSalida() { try { if (c.yo() && c.yo().clase) localStorage.setItem(claveVuelta(), String(Date.now())); } catch (e) {} }
  document.addEventListener('visibilitychange', () => { if (document.hidden) guardarSalida(); });
  addEventListener('pagehide', guardarSalida);
  function alEntrar() {
    if (entro) return; entro = true;
    const y = c.yo(); if (!y || !y.mis || !y.clase || !y.mis.i) return;
    let antes = 0; try { antes = +localStorage.getItem(claveVuelta()) || 0; } catch (e) {}
    if (!antes || Date.now() - antes < 4 * 3600000) return;
    pend = { titulo: '📖 Donde lo dejaste', cl: 'vuelta', gancho: true, extra: '', vence: Date.now() + 120000 };
    clearTimeout(pendT); pendT = setTimeout(mostrarPend, 6000);
  }

  return { ganchoVivido, abrir: abrirPanel, alternar, sugerir, misionCumplida, secundariaCumplida, despedida, alEntrar, ganchoHtml: () => { const y = c.yo(); return y && y.mis ? htmlGancho(ganchoVivido()) : ''; }, boton: '<button type="button" class="ob-btn" data-objetivos="1" aria-label="Mis objetivos" title="Mis objetivos (O)">🎯</button>' };
}
