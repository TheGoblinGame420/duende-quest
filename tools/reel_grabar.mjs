// Graba escenas del juego (local) para el reel: cuadros del screencast con su hora.
// Uso: con el servidor local en marcha (mmo-local, 8787): node tools/reel_grabar.mjs <carpeta>.
// Luego cada escena se monta con ffmpeg (concat con las duraciones de cuadros.json) a 1080x1920.
import fs from 'node:fs';
import { abrirNavegador } from './cdp.mjs';
const B = 'http://localhost:8787';
const OUT = process.argv[2];
const dev = async js => (await (await fetch(B + '/__dev?js=' + encodeURIComponent(js))).json());
const nav = await abrirNavegador({ ancho: 405, alto: 720, movil: true });
await nav.cmd('Emulation.setDeviceMetricsOverride', { width: 405, height: 720, deviceScaleFactor: 2, mobile: true });

async function grabar(nombre, ms, accion) {
  const dir = OUT + '/' + nombre; fs.mkdirSync(dir, { recursive: true });
  const cuadros = [];
  const baja = nav.escuchar(m => {
    if (m.method !== 'Page.screencastFrame') return;
    const f = dir + '/' + String(cuadros.length).padStart(5, '0') + '.jpg';
    fs.writeFileSync(f, Buffer.from(m.params.data, 'base64'));
    cuadros.push({ f, t: m.params.metadata.timestamp });
    nav.cmd('Page.screencastFrameAck', { sessionId: m.params.sessionId }).catch(() => {});
  });
  await nav.cmd('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
  const fin = Date.now() + ms;
  const acc = accion ? accion(fin) : null;
  while (Date.now() < fin) await nav.esperar(100);
  await acc;
  await nav.cmd('Page.stopScreencast');
  baja();
  fs.writeFileSync(dir + '/cuadros.json', JSON.stringify(cuadros));
  console.log(nombre, cuadros.length, 'cuadros');
}
const cap = (t, sub) => nav.js(`(()=>{let d=document.getElementById('reel-cap'); if(!d){d=document.createElement('div'); d.id='reel-cap'; document.body.appendChild(d);} d.innerHTML=${JSON.stringify(t)} + (${JSON.stringify(sub || '')} ? '<small>' + ${JSON.stringify(sub || '')} + '</small>' : ''); d.style.display=${JSON.stringify(t)}?'block':'none'; return 1})()`);

try {
  await nav.ir(B + '/mmo/');
  await nav.esperarA("typeof document.getElementById('b-jugar').onclick === 'function'", 30000);
  await nav.esperar(1500);
  const nombre = 'Duende';
  const n = nombre + Math.floor(Math.random() * 90 + 10);
  await nav.js(`document.getElementById('in-nombre').value='${n}'; document.getElementById('b-jugar').click()`);
  await nav.esperarA('window.__dq && __dq.yo', 60000); await nav.esperar(1000);
  await nav.js(`(document.querySelector('[data-clase="mago"]')||{click(){}}).click(); 1`);
  await nav.esperar(1500);
  await nav.js(`document.querySelectorAll('.modal.on').forEach(m=>m.classList.remove('on')); 1`);
  // Estilo del reel: sin avisos ni consejos; titulo grande con la letra del juego.
  await nav.js(`(()=>{const s=document.createElement('style'); s.textContent='#avisos,#avisos-modal,#consejo,#chat,#h-mision,#h-tareas,#h-mundial,#h-evento,#errores,#presumir,#minimapa,.modal.on:not(#m-reel){display:none!important} #reel-cap{position:fixed;left:0;right:0;top:140px;background:linear-gradient(transparent,rgba(5,8,16,.72) 18%,rgba(5,8,16,.72) 82%,transparent);padding-top:18px!important;padding-bottom:18px!important;z-index:9999;text-align:center;font:20px/1.5 "Press Start 2P",monospace;color:#ffd84a;text-shadow:3px 3px 0 #000,-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000;padding:0 14px;pointer-events:none;display:none} #reel-cap small{display:block;margin-top:10px;font-size:11px;color:#fff}'; document.head.appendChild(s); localStorage.setItem('dq_tuto_'+(__dq.yo.pid||''),'9'); return 1})()`);
  await dev(`(()=>{const s=jug('${n}'); s.c.nivel=60; s.c.skins=['comun','legendaria']; s.c.skin='legendaria'; s.st=mundo.stats(s.c); s.hp=s.st.maxHp; s.c.pw={pocion:50,escudo:20,rayo:20,fuego:20}; mundo.cercaDelBuscador=()=>true; mundo.entrarMapa(s,'castillo',900); mundo.actualizarYo(s); return 1})()`);
  await nav.esperar(2500);
  if (!(await nav.js('localStorage.getItem("dq_auto")==="1"'))) await nav.js(`document.getElementById('t-auto').click(); 1`);

  // Combate en zona: habilidades en bucle mientras avanza.
  const pelear = async fin => {
    let i = 0;
    while (Date.now() < fin) {
      await nav.js(`(()=>{ try { __dq.usarHab(${'[0,1,2,3,4,0,2]'}[${i} % 7]); } catch(e){} return 1 })()`);
      i++;
      await nav.tecla('ArrowRight', 160);
      await nav.esperar(260);
    }
  };
  await cap('UN MMORPG<br>DE DUENDES');
  await grabar('01_zona', 5000, pelear);
  await cap('4 CLASES', 'Guerrero · Mago · Sacerdote · Pícaro');
  await grabar('02_clases', 3500, pelear);

  // Mazmorra con jefe.
  await cap('');
  await dev(`(()=>{const s=jug('${n}'); mundo.entrarMapa(s,'pueblo',1000); mundo.entrarMazmorra(s,{id:'fortaleza'}); return s.k})()`);
  await nav.esperar(2500);
  const jefeX = await dev(`(()=>{const s=jug('${n}'); const w=mundo.mundo[s.k]; const os=[...(w.mons||w.monstruos||new Map()).values?.() || []]; return s.k + ' ' + os.length})()`);
  console.log('mazmorra', JSON.stringify(jefeX));
  await cap('MAZMORRAS<br>Y JEFES');
  await grabar('03_mazmorra', 5000, pelear);

  // Torre.
  await cap('');
  await dev(`(()=>{const s=jug('${n}'); mundo.entrarMapa(s,'pueblo',1000); mundo.entrarTorre(s,{}); return s.k})()`);
  await nav.esperar(3000);
  await cap('LA TORRE<br>DEL DUENDE', 'Pisos sin fin · ranking semanal');
  await grabar('04_torre', 4000, pelear);

  // Pueblo: pesca y vecinos.
  await cap('');
  await dev(`(()=>{const s=jug('${n}'); mundo.entrarMapa(s,'pueblo',475); return 1})()`);
  await nav.esperar(2500);
  await cap('PESCA, MONTURAS<br>Y HERMANDADES');
  await grabar('05_pueblo', 3500, async fin => { await nav.tecla('KeyE', 80); });

  // Cierre.
  await nav.js(`(()=>{const d=document.createElement('div'); d.id='m-reel'; d.style.cssText='position:fixed;inset:0;z-index:10000;background:radial-gradient(circle at 50% 40%,#1c2540,#0a0e18 70%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;font-family:"Press Start 2P",monospace'; d.innerHTML='<img src="/assets/skins/skin_legendariafull.png" style="height:210px;image-rendering:pixelated;animation:flotar 2.4s ease-in-out infinite"><div style="font-size:26px;line-height:1.5;color:#fff;text-shadow:3px 3px 0 #000">DUENDE QUEST</div><div style="font-size:16px;color:#ffd84a;margin-top:-12px">ONLINE</div><div style="font:600 17px/1.5 system-ui,sans-serif;color:#e6e9f0">Gratis · Sin descargas<br>En Telegram y en el navegador</div><div style="font-size:12px;color:#38bdf8;margin-top:8px">@duendequest_bot</div>'; document.body.appendChild(d); document.getElementById('reel-cap').style.display='none'; return 1})()`);
  await nav.esperar(600);
  await grabar('06_cierre', 3500);
  console.log(nav.consola.filter(x => /EXCEP/i.test(x)).slice(0, 5));
} finally { await nav.cerrar(); }
