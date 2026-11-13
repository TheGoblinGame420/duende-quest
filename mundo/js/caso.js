// ═══════════════════════════════════════════════════════
// EL CASO DEL TRAIDOR: contenido de la ventana (se pinta dentro de #v-diario).
// Una sola columna de pistas y las cuatro caras en dos columnas: se lee a 360x640,
// a 640x360 y en PC. Sin datos de pago ni nada del HUD.
// ═══════════════════════════════════════════════════════
import { CASO, PISTAS, APUNTES, SOSPECHOSOS, VERDAD, estadoSospechoso, reaccionCaso } from '/mmo/js/caso.js?v=378';

const COLOR = { sospecha: '#fca5a5', duda: '#fde68a', limpio: '#4ade80', nadie: '#cbd5e1', culpable: '#f0abfc' };

export function htmlCaso(st, { sec, nivel, esc, zonaNombre }) {
  const hechas = new Set(st.p), n = hechas.size, cerrado = !!(sec || {})[CASO.cierre + ':ok'], puede = !st.res && !cerrado && n >= CASO.minSospecha;
  const hallada = x => hechas.has(x) || !!(sec || {})[x + ':ok'];
  const sig = PISTAS.find(p => !hechas.has(p.id));
  let h = '<div data-caso="1">';
  h += `<p class="vv-p" style="margin:0 0 6px">El nudo de la Casa del Cántaro no se cortó: <b style="color:#fde68a">se desató</b>. Solo cuatro sabían hacerlo.</p>`;
  h += `<p class="vv-p" style="margin:0 0 4px"><b>🕵 Pistas: ${n}/${PISTAS.length}</b></p><div style="height:8px;border-radius:5px;background:rgba(255,255,255,.14);overflow:hidden;margin-bottom:10px"><i style="display:block;height:100%;width:${Math.round(n / PISTAS.length * 100)}%;background:#c084fc"></i></div>`;
  if (st.res) {
    h += `<div style="padding:8px 10px;border-radius:10px;background:rgba(192,132,252,.14);border:1px solid rgba(192,132,252,.5);margin-bottom:10px"><b style="color:#f0abfc">✓ Caso resuelto</b>${VERDAD.map(t => `<p class="vv-p" style="margin:6px 0">${esc(t)}</p>`).join('')}<p class="vv-p" style="margin:6px 0 0;color:#fde68a">${esc(reaccionCaso(st.s, st.sN))}</p></div>`;
  } else if (sig) {
    h += `<p class="vv-p" style="margin:0 0 10px;padding:6px 8px;border-radius:8px;background:rgba(253,230,138,.10);border:1px solid rgba(253,230,138,.35)">🔎 <b>Próxima pista:</b> ${esc(zonaNombre(sig.zona))}, ${(nivel || 1) >= sig.nv ? 'ya tienes el nivel: mira tus misiones ahí' : 'desde Nv ' + sig.nv}.</p>`;
  }
  h += '<p class="vv-p" style="margin:0 0 6px;font-weight:700">Los cuatro que sabían el nudo</p>';
  h += '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-bottom:6px">';
  for (const q of SOSPECHOSOS) {
    const e = estadoSospechoso(q, hallada, st.res), mio = st.s === q.id;
    h += `<div style="padding:6px 7px;border-radius:9px;background:rgba(255,255,255,.05);border:${mio ? '2px solid #fde68a' : '1px solid rgba(255,255,255,.14)'};min-width:0">`
      + `<b style="display:block;font-size:13px;line-height:1.2">${q.emoji} ${esc(q.nombre)}</b>`
      + `<small style="display:block;color:${COLOR[e.k]};font-weight:700;margin:2px 0">${esc(e.txt)}</small>`
      + `<small style="display:block;line-height:1.25">${esc(e.nota)}</small>`
      + (puede ? `<button type="button" class="btn ${mio ? '' : 'sec'}" data-caso-s="${mio ? '' : q.id}" style="width:100%;min-height:36px;padding:4px;font-size:12px;margin-top:5px">${mio ? '✓ Tu sospecha' : 'Sospecho'}</button>` : '')
      + '</div>';
  }
  h += '</div>';
  if (!st.res) h += `<p class="vv-p" style="font-size:12px;margin:0 0 10px;opacity:.85">${cerrado ? 'Ya sabes adónde ir: tu sospecha queda como está, y equivocarte no te quita nada.' : puede ? 'Puedes cambiar de idea hasta que el caso se cierre. Al final se sabrá, y equivocarte no te quita nada.' : `Con ${CASO.minSospecha} pistas podrás señalar a alguien (${n}/${CASO.minSospecha}).`}</p>`;
  h += '<p class="vv-p" style="margin:10px 0 6px;font-weight:700">El cuaderno</p>';
  for (const p of PISTAS) {
    if (hechas.has(p.id)) {
      h += `<div style="padding:6px 8px;border-radius:9px;background:rgba(74,222,128,.07);border:1px solid rgba(74,222,128,.28);margin-bottom:5px"><b style="font-size:13px">${p.emoji} ${esc(p.titulo)}</b> <small style="opacity:.75">${esc(p.tipo)}</small><p class="vv-p" style="margin:3px 0;font-size:13px">${esc(p.texto)}</p><small style="color:#fde68a">${esc(p.efecto)}</small></div>`;
    } else {
      h += `<div style="padding:6px 8px;border-radius:9px;background:rgba(255,255,255,.03);border:1px dashed rgba(255,255,255,.2);margin-bottom:5px"><b style="font-size:13px;opacity:.7">❔ ???</b><p class="vv-p" style="margin:3px 0;font-size:13px">${(nivel || 1) >= p.nv ? esc(p.pregunta) : 'Aún no llegas hasta aquí.'}</p><small style="opacity:.7">${esc(zonaNombre(p.zona))} · Nv ${p.nv}</small></div>`;
    }
  }
  const apuntes = APUNTES.filter(a => hallada(a.mision));
  if (apuntes.length) h += '<p class="vv-p" style="margin:10px 0 6px;font-weight:700">Lo que oíste por ahí</p>' + apuntes.map(a => `<div style="padding:6px 8px;border-radius:9px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);margin-bottom:5px"><b style="font-size:13px">${a.emoji} ${esc(a.titulo)}</b><p class="vv-p" style="margin:3px 0;font-size:13px">${esc(a.texto)}</p><small style="color:#fde68a">${esc((st.res && a.efectoRes) || a.efecto)}</small></div>`).join('');
  h += '<button type="button" class="btn sec" data-caso-volver="1" style="width:100%;min-height:40px;margin-top:6px">← La Leyenda</button></div>';
  return h;
}
