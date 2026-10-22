// ═══════════════════════════════════════════════════════
// Navegador sin ventana para probar el juego y sacar capturas, sin
// librerias: lanza el Chrome (o Edge) instalado con --remote-debugging-port
// y le habla por el protocolo de DevTools con el WebSocket que trae Node.
//
//   import { abrirNavegador } from './cdp.mjs';
//   const nav = await abrirNavegador({ ancho: 960, alto: 600 });
//   await nav.ir('http://localhost:8787/mmo/');
//   await nav.foto('captura.png');
//
// tools/ no se publica (.assetsignore).
// ═══════════════════════════════════════════════════════
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RUTAS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
];
const esperar = ms => new Promise(r => setTimeout(r, ms));

export async function abrirNavegador({ ancho = 960, alto = 600, movil = false, puerto = 9333 + Math.floor(Math.random() * 500), args = [] } = {}) {
  const exe = RUTAS.find(r => fs.existsSync(r));
  if (!exe) throw new Error('No encontré Chrome ni Edge');
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'dq-cdp-'));
  const proc = spawn(exe, [
    '--headless=new', `--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`,
    `--window-size=${ancho},${alto}`, '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required', '--mute-audio',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', ...args, 'about:blank',
  ], { stdio: 'ignore' });
  let lista = null;
  for (let i = 0; i < 60 && !lista; i++) {
    await esperar(150);
    try { lista = await (await fetch(`http://127.0.0.1:${puerto}/json`)).json(); } catch (e) {}
  }
  const pagina = lista && lista.find(t => t.type === 'page');
  if (!pagina) { proc.kill(); throw new Error('Chrome no abrió'); }
  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise((ok, mal) => { ws.onopen = ok; ws.onerror = mal; });
  let sig = 1;
  const pend = new Map();
  const oyentes = [];
  const consola = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.mal(new Error(m.error.message)) : p.ok(m.result); }
    else if (m.method) {
      if (m.method === 'Runtime.consoleAPICalled') consola.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' '));
      if (m.method === 'Runtime.exceptionThrown') consola.push('EXCEPCION: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
      for (const f of oyentes) f(m);
    }
  };
  // Con tope de 30 s: una pagina colgada no deja el script esperando para siempre.
  const cmd = (method, params = {}) => new Promise((ok, mal) => {
    const id = sig++;
    const t = setTimeout(() => { if (pend.has(id)) { pend.delete(id); mal(new Error('CDP sin respuesta: ' + method)); } }, 30000);
    pend.set(id, { ok: v => { clearTimeout(t); ok(v); }, mal: e => { clearTimeout(t); mal(e); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
  await cmd('Page.enable');
  await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: movil });
  if (movil) await cmd('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  const nav = {
    cmd, consola,
    async ir(url) {
      const carga = new Promise(r => { const f = m => { if (m.method === 'Page.loadEventFired') { oyentes.splice(oyentes.indexOf(f), 1); r(); } }; oyentes.push(f); });
      await cmd('Page.navigate', { url });
      await Promise.race([carga, esperar(15000)]);
    },
    async js(expr) {
      const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    async esperarA(expr, ms = 10000) {
      const fin = Date.now() + ms;
      while (Date.now() < fin) { try { if (await nav.js(expr)) return true; } catch (e) {} await esperar(100); }
      throw new Error('Tiempo agotado esperando: ' + expr);
    },
    async foto(archivo) {
      const r = await cmd('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(archivo, Buffer.from(r.data, 'base64'));
      return archivo;
    },
    // Tecla con su "code" (KeyZ, Digit1, ArrowLeft...). ms = cuanto se mantiene.
    async tecla(code, ms = 60) {
      const key = code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code === 'Space' ? ' ' : code;
      const base = { code, key, windowsVirtualKeyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0 };
      await cmd('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: key.length === 1 ? key : undefined });
      await esperar(ms);
      await cmd('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    },
    async clic(x, y) {
      for (const type of ['mousePressed', 'mouseReleased']) await cmd('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    },
    async toque(x, y, ms = 80) {
      await cmd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await esperar(ms);
      await cmd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
    // Eventos del protocolo (p. ej. Page.screencastFrame). Devuelve la baja.
    escuchar(f) { oyentes.push(f); return () => { const i = oyentes.indexOf(f); if (i >= 0) oyentes.splice(i, 1); }; },
    esperar,
    async cerrar() { try { ws.close(); } catch (e) {} proc.kill(); await esperar(300); try { fs.rmSync(perfil, { recursive: true, force: true }); } catch (e) {} },
  };
  return nav;
}
