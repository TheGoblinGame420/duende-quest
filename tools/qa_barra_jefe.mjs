// ═══════════════════════════════════════════════════════
// CLASSIC en el celular: la barra del jefe no debe pisar el seguimiento de la
// derecha (misiones y eventos). Entra como invitado, sube a Nv 25 por /__dev,
// abre la Fortaleza Goblin, camina hasta ver la barra del jefe y mide.
// Falla (codigo 1) si se solapan en 360x740, 375x812 o 740x360.
//
//   PUERTO=8802 DATOS=/tmp/x.json node tools/mmo_local.mjs      (en otra terminal)
//   node tools/qa_barra_jefe.mjs [http://localhost:8802]
//
// tools/ no se publica (.assetsignore).
// ═══════════════════════════════════════════════════════
import { abrirNavegador } from './cdp.mjs';

const BASE = (process.argv[2] || 'http://localhost:8802').replace(/\/$/, '');
const dev = async js => { const r = await (await fetch(BASE + '/__dev?js=' + encodeURIComponent(js))).json(); if (!r.ok) throw new Error(r.e); return r.v; };
const fallos = [];
for (const [ancho, alto] of [[360, 740], [375, 812], [740, 360]]) {
  const nav = await abrirNavegador({ ancho, alto, movil: true });
  const et = `${ancho}x${alto}`;
  try {
    await nav.ir(BASE + '/mmo/');
    await nav.esperarA("typeof document.getElementById('b-jugar')?.onclick === 'function'", 60000);
    await nav.esperar(800);
    const n = 'Jefe' + Math.floor(Math.random() * 9000 + 1000);
    await nav.js(`document.getElementById('in-nombre').value='${n}'; document.getElementById('b-jugar').click(); 1`);
    await nav.esperarA('window.__dq && __dq.yo', 60000);
    await nav.esperar(1500);
    await nav.js(`document.querySelectorAll('.modal.on').forEach(m => m.classList.remove('on')); 1`);
    await dev(`(() => { const s = jug('${n}'); s.c.nivel = 25; s.st = mundo.stats(s.c); s.hp = s.st.maxHp; const cerca = mundo.cercaDelBuscador; mundo.cercaDelBuscador = () => true; mundo.entrarMapa(s, 'pueblo', 1000); mundo.entrarMazmorra(s, { id: 'fortaleza' }); mundo.cercaDelBuscador = cerca; mundo.actualizarYo(s); return s.k; })()`);
    const visible = `getComputedStyle(document.getElementById('jefe-bar')).display !== 'none'`;
    for (let i = 0; i < 30 && !(await nav.js(visible)); i++) await nav.tecla('ArrowRight', 400);
    if (!(await nav.js(visible))) { fallos.push(`${et}: no apareció la barra del jefe`); continue; }
    // Peor caso: un evento largo en el seguimiento (como «Invasión del desierto» con su contador).
    await nav.js(`(() => { const d = document.createElement('div'); d.id = 'qa-evento-largo'; d.style.cssText = 'font-size:11px;line-height:1.4'; d.innerHTML = 'Invasión del desierto · Desierto Dorado<br>4:44 · Invasores 0/20<br>Dragón de la Tormenta en 19:45'; document.getElementById('seguimiento').appendChild(d); return 1; })()`);
    await nav.esperar(1200);   // la barra se recoloca cada 500 ms
    const m = await nav.js(`(() => { const a = document.getElementById('jefe-bar').getBoundingClientRect(), s = document.getElementById('seguimiento').getBoundingClientRect();
      return { pisa: a.left < s.right && s.left < a.right && a.top < s.bottom - 1 && s.top < a.bottom, jefe: [a.left, a.top, a.right, a.bottom].map(Math.round), seg: [s.left, s.top, s.right, s.bottom].map(Math.round) }; })()`);
    console.log(`${et}: barra ${JSON.stringify(m.jefe)} · seguimiento ${JSON.stringify(m.seg)}${m.pisa ? ' · SE PISAN' : ''}`);
    if (m.pisa) fallos.push(`${et}: la barra del jefe pisa el seguimiento`);
    const exc = nav.consola.filter(l => l.startsWith('EXCEPCION'));
    if (exc.length) fallos.push(`${et}: ${exc.length} excepciones: ${exc[0].slice(0, 200)}`);
  } catch (e) { fallos.push(`${et}: ${e.message}`); }
  finally { await nav.cerrar(); }
}
if (fallos.length) { console.error('\nFALLOS:\n - ' + fallos.join('\n - ')); process.exit(1); }
console.log('\nBarra del jefe OK: no pisa el seguimiento.');
process.exit(0);
