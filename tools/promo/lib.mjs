// ═══════════════════════════════════════════════════════
// Utilidades del video promocional (tools/promo/): servidor local propio,
// navegador sin ventana, entrar al MMO, "cerebro" que juega solo y
// grabacion de fotogramas por el protocolo de DevTools (Page.startScreencast).
//
// tools/ no se publica (.assetsignore). La salida va a promo/ (ignorada por
// git y por el Worker).
// ═══════════════════════════════════════════════════════
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirNavegador } from '../cdp.mjs';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PROMO = path.join(RAIZ, 'promo');
export const TRABAJO = path.join(PROMO, '_trabajo');
export const esperar = ms => new Promise(r => setTimeout(r, ms));

// ── Servidor local PROPIO (otro puerto y otro archivo de datos) para no
// tocar el mundo del :8787 que se usa al programar. Mundo nuevo cada vez.
export async function iniciarServidor(puerto = 8796) {
  const datos = path.join(TRABAJO, 'mundo_promo.json');
  try { fs.rmSync(datos); } catch (e) {}
  const proc = spawn(process.execPath, [path.join(RAIZ, 'tools', 'mmo_local.mjs')], {
    env: { ...process.env, PUERTO: String(puerto), DATOS: datos }, stdio: 'ignore',
  });
  const base = `http://localhost:${puerto}`;
  for (let i = 0; i < 100; i++) {
    await esperar(150);
    try { if ((await fetch(base + '/mmo/')).ok) break; } catch (e) {}
  }
  const dev = async js => {
    const r = await (await fetch(base + '/__dev?js=' + encodeURIComponent(js))).json();
    if (!r.ok) throw new Error('__dev: ' + r.e);
    return r.v;
  };
  return { base, dev, cerrar: () => proc.kill() };
}

// CSS para tomas limpias: fuera tutoriales, avisos y paneles de texto que
// tapan el juego (el HUD de vida y la barra de acción se quedan).
const CSS_LIMPIO = `
#avisos, #errores, #consejo, #seguimiento, #presumir, #monedero, #invitacion, #emotes,
#mapa-nom, #m-muerte { display: none !important; }
`;

// Abre un navegador vertical (CSS 540x960, dpr 2 = 1080x1920 reales).
export async function navegador({ ancho = 540, alto = 960, escala = 2, movil = true } = {}) {
  // Sin --force-device-scale-factor, Page.startScreencast entrega fotos en
  // pixeles CSS (540x960) aunque la emulacion diga dpr 2.
  const nav = await abrirNavegador({ ancho, alto, movil, args: ['--force-device-scale-factor=' + escala] });
  await nav.cmd('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: escala, mobile: movil });
  return nav;
}
// Entra al MMO con un nombre y una clase y deja la pantalla limpia.
export async function entrar(nav, base, nombre, clase) {
  await nav.ir(base + '/mmo/');
  await nav.esperarA(`document.getElementById('m-inicio') && document.getElementById('m-inicio').classList.contains('on')`, 30000);
  await esperar(400);
  await nav.js(`document.getElementById('in-nombre').value=${JSON.stringify(nombre)}`);
  await nav.js(`document.getElementById('b-jugar').click()`);
  await nav.esperarA(`!!document.querySelector('[data-clase=${clase}]')`, 30000);
  await esperar(500);
  await nav.js(`document.querySelector('[data-clase=${clase}]').click()`);
  await nav.esperarA(`window.__dq && window.__dq.yo && window.__dq.yo.clase === '${clase}'`, 20000);
  await esperar(1200);
  await limpiar(nav);
}

export async function limpiar(nav, cerrar = true) {
  await nav.js(`(()=>{let st=document.getElementById('promo-css');if(!st){st=document.createElement('style');st.id='promo-css';document.head.appendChild(st);}if(!st.textContent.includes('#avisos'))st.textContent=${JSON.stringify(CSS_LIMPIO)};if(${cerrar})document.querySelectorAll('.modal.on').forEach(m=>m.classList.remove('on'));return 1})()`);
}
export const cerrarModales = nav => nav.js(`document.querySelectorAll('.modal.on').forEach(m=>m.classList.remove('on'))`);

// ── Cerebro: juega solo dentro de la pagina (teclas sinteticas + __dq).
// modo: 'cazar' (va al monstruo mas cercano, pega y usa habilidades),
// 'quieto' (solo pega a lo que tenga al alcance), 'andar' (camina a dir),
// 'jugador' (pelea con otro jugador: duelo), 'nada'.
export async function cerebro(nav, op = {}) {
  await nav.js(`(()=>{
    const op = ${JSON.stringify(op)};
    window.__promo = op;
    if (window.__promoT) clearInterval(window.__promoT);
    const tecla = (code, on) => dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code, key: code, bubbles: true }));
    let dirActual = 0, ultHab = 0, ultSalto = 0;
    const mover = d => {
      if (d === dirActual) return;
      if (dirActual < 0) tecla('ArrowLeft', false);
      if (dirActual > 0) tecla('ArrowRight', false);
      if (d < 0) tecla('ArrowLeft', true);
      if (d > 0) tecla('ArrowRight', true);
      dirActual = d;
    };
    window.__promoMover = mover;
    window.__promoT = setInterval(() => {
      const q = window.__dq, o = window.__promo;
      if (!q || !q.yo) return;
      const P = q.P;
      if (!o.panel) document.querySelectorAll('.modal.on').forEach(m => m.classList.remove('on'));
      if (P.muerto) { q.mandar({ t: 'revivir' }); return; }
      if (o.modo === 'nada') { mover(0); return; }
      if (o.modo === 'andar') { mover(o.dir || 1); if (o.saltar && Date.now() - ultSalto > (o.saltar || 1500)) { ultSalto = Date.now(); tecla('Space', true); setTimeout(() => tecla('Space', false), 60); } return; }
      let blanco = null, dist = 1e9, esJug = false;
      if (o.modo === 'jugador') {
        for (const [id, j] of q.otros) { if (!o.rival || j.nombre === o.rival) { const d = Math.abs(j.x - P.x); if (d < dist) { dist = d; blanco = j; blanco._id = id; esJug = true; } } }
      } else {
        for (const [id, m] of q.mons) { if (m.muereT || m.hp <= 0) continue; const d = Math.abs(m.x - P.x); if (d < dist) { dist = d; blanco = m; blanco._id = id; } }
      }
      if (!blanco) { mover(o.patrulla || 0); return; }
      q.objetivo = { k: esJug ? 'p' : 'm', id: blanco._id };
      const lejos = q.yo.clase === 'mago' || q.yo.clase === 'sacerdote' ? (o.dist || 260) : 50;
      const dx = blanco.x - P.x;
      if (Math.abs(dx) > lejos) mover(Math.sign(dx));
      else if (Math.abs(dx) < lejos * 0.35 && lejos > 100) mover(-Math.sign(dx));
      else { mover(0); P.f = dx >= 0 ? 1 : -1; }
      if (Math.abs(dx) <= lejos + 40) {
        const habs = o.habs || [0, 1, 2, 3];
        if (Date.now() - ultHab > (o.ritmo || 700)) {
          ultHab = Date.now();
          q.usarHab(habs[Math.floor(Math.random() * habs.length)]);
        }
        q.atacar();
      }
    }, 90);
    return 1;
  })()`);
}

// ── Grabacion: Page.startScreencast entrega cada fotograma pintado con su
// marca de tiempo. Se guardan como JPG de calidad alta + lista con tiempos,
// y luego ffmpeg los vuelve 30 fps constantes (ver fotogramasAClip).
export async function grabar(nav, dir, ms, { antes } = {}) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const lista = [];
  let n = 0, escribiendo = Promise.resolve();
  const baja = nav.escuchar(m => {
    if (m.method !== 'Page.screencastFrame') return;
    const { data, metadata, sessionId } = m.params;
    nav.cmd('Page.screencastFrameAck', { sessionId }).catch(() => {});
    const f = path.join(dir, String(n++).padStart(5, '0') + '.jpg');
    lista.push({ f, t: metadata.timestamp });
    const buf = Buffer.from(data, 'base64');
    escribiendo = escribiendo.then(() => fs.promises.writeFile(f, buf));
  });
  await nav.cmd('Page.startScreencast', { format: 'jpeg', quality: 93, everyNthFrame: 1 });
  if (antes) await antes();
  await esperar(ms);
  await nav.cmd('Page.stopScreencast');
  baja();
  await escribiendo;
  // Lista para el demuxer concat de ffmpeg con la duracion real de cada foto.
  let txt = '';
  for (let i = 0; i < lista.length; i++) {
    const d = i + 1 < lista.length ? lista[i + 1].t - lista[i].t : 1 / 30;
    txt += `file '${lista[i].f.replace(/\\/g, '/')}'\nduration ${Math.max(0.001, d).toFixed(4)}\n`;
  }
  if (lista.length) txt += `file '${lista[lista.length - 1].f.replace(/\\/g, '/')}'\n`;
  fs.writeFileSync(path.join(dir, 'lista.txt'), txt);
  const dur = lista.length > 1 ? lista[lista.length - 1].t - lista[0].t : 0;
  return { fotos: lista.length, segundos: dur, fps: lista.length / Math.max(0.001, dur) };
}
