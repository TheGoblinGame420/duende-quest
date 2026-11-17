// ═══════════════════════════════════════════════════════
// Modo trailer de ORIGINS (3D): /mundo/?trailer=1, SOLO en el servidor local
// (localhost / 127.0.0.1). mundo.js lo carga con import() solo entonces: un
// jugador normal nunca baja este archivo ni nota nada.
//
//   ?trailer=1                    pantalla limpia + coreografía automática
//   &escena=plaza|fly|pvp|auto    qué escena repite (auto = las tres en ciclo)
//
// El director usa las MISMAS teclas que un jugador (eventos de teclado sobre
// window) y la cámara de __dq3: el servidor sigue decidiendo daño, vuelo y
// todo lo demás. Poner gente en la plaza, monstruos alrededor o el permiso de
// alas lo hace el grabador con /__dev (scripts/record-clips.mjs).
//
// Con el arte cargado y el duende en el mundo: window.__TRAILER_READY__ = true
// y window.__TRAILER__ = { escena(nombre), parar() }.
// ═══════════════════════════════════════════════════════

const DURA = { plaza: 7000, fly: 7000, pvp: 8000 };

export function iniciarTrailer(api) {
  const q = new URLSearchParams(location.search);
  let escena = q.get('escena') || 'auto';
  window.__TRAILER_READY__ = false;

  // ── Pantalla limpia: el lienzo 3D y #capa (números de daño, nombres y
  // gestos encima de cada duende). Lo demás, oculto.
  document.body.classList.add('trailer');
  const css = document.createElement('style');
  css.textContent = `
    body.trailer *{visibility:hidden!important}
    body.trailer #lienzo,body.trailer #vineta,body.trailer #herida,body.trailer #capa,body.trailer #capa *{visibility:visible!important}
    body.trailer #capa .burbuja,body.trailer #capa .chat3{visibility:hidden!important}
    body.trailer{cursor:none}`;
  document.head.appendChild(css);

  // ── Teclas sintéticas ──
  const abajo = new Set();
  const tecla = (code, on) => {
    if (on && abajo.has(code)) return;
    if (on) abajo.add(code); else abajo.delete(code);
    const key = code === 'Space' ? ' ' : code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code;
    dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code, key, bubbles: true }));
  };
  const pulsar = (code, ms = 60) => { tecla(code, true); setTimeout(() => tecla(code, false), ms); };
  const soltarTodo = () => { for (const c of [...abajo]) tecla(c, false); };
  const esperar = ms => new Promise(r => setTimeout(r, ms));

  // Ventanas que salen solas (premio diario, bautizo, historia...): fuera,
  // porque con una abierta el juego ignora las teclas.
  const cerrarVentanas = () => {
    document.querySelectorAll('.modal.on [data-cerrar]').forEach(b => { try { b.click(); } catch (e) {} });
    document.querySelectorAll('.modal.on').forEach(v => { if (v.id !== 'v-error') v.classList.remove('on'); });
    for (const id of ['tarjeta-bautizo', 'probar-clase', 'dq-noche']) { const el = document.getElementById(id); if (el) el.remove(); }
  };
  setInterval(cerrarVentanas, 400);

  // ── Cámara: órbita suave (ease in-out) de yaw0 a yaw1 en ms ──
  let orbitaId = 0;
  const orbita = (ms, y0, y1, p0, p1 = p0) => {
    const id = ++orbitaId, t0 = performance.now();
    const f = () => {
      if (id !== orbitaId) return;
      const k = Math.min(1, (performance.now() - t0) / ms), e = 0.5 - 0.5 * Math.cos(Math.PI * k);
      api.camara(y0 + (y1 - y0) * e, p0 + (p1 - p0) * e);
      if (k < 1) requestAnimationFrame(f);
    };
    f();
  };
  const sinOrbita = () => { orbitaId++; };

  // ── Escenas ──
  let corriendo = 0;
  const ESCENAS = {
    // Panorama de la plaza con la gente: órbita lenta, el duende quieto.
    async plaza(fin) {
      const y = api.camYaw;
      orbita(fin - Date.now(), y - 0.7, y + 0.7, 0.24, 0.32);
      while (Date.now() < fin) await esperar(100);
    },
    // Alas: V, despega con Espacio y vuela hacia delante; la cámara la lleva el juego.
    async fly(fin) {
      sinOrbita();
      pulsar('KeyV', 80); await esperar(250);
      tecla('Space', true); tecla('KeyW', true); await esperar(2400); tecla('Space', false);   // sube alto antes de avanzar
      let gira = 0;
      while (Date.now() < fin) {   // vira un poco a los lados y sigue subiendo a ratos
        await esperar(700);
        const lado = gira++ % 2 ? 'KeyA' : 'KeyD';
        tecla(lado, true); tecla('Space', true); await esperar(300); tecla(lado, false); tecla('Space', false);
      }
      tecla('KeyW', false);
    },
    // Combate: objetivo, golpe mantenido y habilidades + poderes en cadena; la cámara rodea.
    async pvp(fin) {
      const y = api.camYaw;
      orbita(fin - Date.now(), y + 0.35, y - 0.35, 0.62, 0.52);   // cámara alta: los arbustos no tapan
      pulsar('Tab'); tecla('Digit1', true);
      let i = 0;
      while (Date.now() < fin) {
        await esperar(420);
        if (!api.objetivo) pulsar('Tab');
        pulsar(i % 2 ? 'Key' + 'QFGT'[(i >> 1) % 4] : 'Digit' + (2 + (i >> 1) % 4));
        i++;
      }
      tecla('Digit1', false);
    },
  };
  async function correr(nombre, ms) {
    const id = ++corriendo;
    soltarTodo();
    const lista = nombre === 'auto' ? ['plaza', 'fly', 'pvp'] : [nombre];
    for (let i = 0; id === corriendo; i++) {
      const n = lista[i % lista.length];
      if (!ESCENAS[n]) throw new Error('escena desconocida: ' + n);
      await ESCENAS[n](Date.now() + (ms || DURA[n]));
      soltarTodo();
      if (ms) break;   // el grabador pidió una sola toma
    }
  }

  window.__TRAILER__ = {
    // Una toma de ms milisegundos (sin ms: repite en bucle).
    escena(n, ms) { escena = n || 'auto'; return correr(escena, ms); },
    parar() { corriendo++; sinOrbita(); soltarTodo(); },
    orbita,
  };

  // ── Listo: arte cargado, pantalla de carga fuera, duende en el mundo, y
  // 2 s para que los modelos lleguen a la GPU.
  const listo = async () => {
    while (!(api.listo() && api.yo)) await esperar(200);
    try { await document.fonts.ready; } catch (e) {}
    await esperar(2000);
    cerrarVentanas();
    window.__TRAILER_READY__ = true;
    if (!q.has('quieto')) correr(escena);   // &quieto=1: el grabador manda cada toma
  };
  listo();
}
