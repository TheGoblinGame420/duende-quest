// ── DUENDE QUEST — utilidades de DOM compartidas ──
// Escapa texto que viene de la base de datos o de Telegram antes de meterlo
// en innerHTML. Los usernames son texto arbitrario del usuario: sin esto, un
// nombre como <img src=x onerror=...> ejecuta código en la Mini App de todo
// el que abra el ranking, y con él se puede robar el initData de la víctima.
window.DQEsc = function (s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};
