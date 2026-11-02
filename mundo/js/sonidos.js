// ═══════════════════════════════════════════════════════
// SONIDOS SINTETIZADOS DE ORIGINS (WebAudio, sin descargas)
//
// Todo pasa por un bus comun: ganancia maestra -> compresor -> altavoz, asi
// diez golpes a la vez no saturan el movil. Cada sonido varia un poco de tono
// (nunca suena identico dos veces) y hay un limite de voces sintetizadas.
// pos(x, z) da volumen y paneo estereo segun la distancia y el lado respecto
// a la camara (para lo que hacen otros: golpes, muertes, voces de monstruos).
// ═══════════════════════════════════════════════════════
export function crearSonidos({ ctx, puede, oyente }) {
  // ctx(): el AudioContext de los efectos (o null). puede(): sonido encendido,
  // pestaña visible y Telegram activo. oyente(): { x, z, rx, rz } posicion del
  // jugador y vector «derecha» de la camara.
  let bus = null, busCtx = null, ruidoBuf = null, voces = 0, ultR = 1;
  const ultimo = {};
  const MAX_VOCES = 6;

  function salida() {
    const c = ctx();
    if (!c) return null;
    if (bus && busCtx === c) return bus;
    try {
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 4;
      comp.attack.value = 0.004; comp.release.value = 0.2;
      // El compresor de WebAudio sube solo ~+8 dB (makeup automatico con estos valores):
      // 0.4 deja lo suave (pasos, clics) como antes frente a la musica y doma los picos.
      const g = c.createGain(); g.gain.value = 0.4;
      g.connect(comp); comp.connect(c.destination);
      bus = g; busCtx = c;
    } catch (e) { bus = c.destination; busCtx = c; }
    return bus;
  }
  // Tono al azar, distinto del anterior (±6 %).
  function variar(ancho) {
    const a = ancho || 0.06;
    let r = 1 - a + Math.random() * a * 2, n = 0;
    while (Math.abs(r - ultR) < a * 0.25 && n++ < 4) r = 1 - a + Math.random() * a * 2;
    ultR = r; return r;
  }
  // Volumen y paneo de algo que pasa en (x, z). null si esta demasiado lejos.
  function pos(x, z, lejos) {
    const o = oyente && oyente();
    if (!o || x == null) return { vol: 1, pan: 0 };
    const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz), max = lejos || 55;
    if (d > max) return null;
    const vol = 1 / (1 + (d / 14) * (d / 14)) * (1 - d / max * 0.5);
    const pan = d < 1.5 ? 0 : Math.max(-1, Math.min(1, (dx * o.rx + dz * o.rz) / d)) * 0.75;
    return { vol, pan };
  }
  // Nodo final de un sonido: ganancia (+ paneo si el navegador lo tiene).
  function cadena(c, vol, pan) {
    const g = c.createGain(); g.gain.value = vol;
    if (pan && c.createStereoPanner) { try { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(salida()); return g; } catch (e) {} }
    g.connect(salida());
    return g;
  }
  function ruido(c) {
    if (ruidoBuf && ruidoBuf.sampleRate === c.sampleRate) return ruidoBuf;
    const n = Math.floor(c.sampleRate * 2.2), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return (ruidoBuf = b);
  }
  // Piezas: un tono con envolvente y un golpe de ruido filtrado.
  function tono(c, dest, t, f, dur, { tipo = 'sine', vol = 0.2, f2 = 0, ataque = 0.005 } = {}) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.03);
  }
  function soplo(c, dest, t, dur, { filtro = 'bandpass', f = 1000, f2 = 0, q = 1, vol = 0.2, ataque = 0.01 } = {}) {
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = ruido(c); fl.type = filtro; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  }
  // Campanita: fundamental + parcial inarmonico (suena a metal, no a pitido).
  function campana(c, dest, t, f, dur, vol) {
    tono(c, dest, t, f, dur, { vol, ataque: 0.002 });
    tono(c, dest, t, f * 2.76, dur * 0.45, { vol: vol * 0.35, ataque: 0.002 });
  }

  const RECETAS = {
    // Cofre: crujido de bisagra de madera + campanita del tesoro.
    cofre(c, d, t, r) {
      soplo(c, d, t, 0.32, { f: 380 * r, f2: 180 * r, q: 6, vol: 0.32, ataque: 0.03 });
      tono(c, d, t, 120 * r, 0.3, { tipo: 'sawtooth', vol: 0.05, f2: 70 * r, ataque: 0.03 });
      campana(c, d, t + 0.26, 1568 * r, 0.6, 0.12);
      campana(c, d, t + 0.36, 2093 * r, 0.8, 0.1);
      return 1.2;
    },
    // Botin segun rareza: 0-1 un brillo corto; 2 epico arpegio; 3+ legendario con acorde y destellos.
    botin(c, d, t, r, o) {
      const z = o.r | 0, notas = z >= 3 ? [784, 988, 1175, 1568, 1976, 2349] : z >= 2 ? [659, 831, 988, 1319] : z >= 1 ? [880, 1319] : [1047];
      notas.forEach((f, i) => campana(c, d, t + i * (z >= 3 ? 0.07 : 0.08), f * r, 0.35 + i * 0.05, z >= 2 ? 0.1 : 0.08));
      if (z >= 2) soplo(c, d, t, 0.9, { filtro: 'highpass', f: 6000, vol: 0.05, ataque: 0.2 });
      if (z >= 3) [392, 494, 587].forEach(f => tono(c, d, t + 0.1, f * r, 1.6, { tipo: 'triangle', vol: 0.05, ataque: 0.15 }));
      return z >= 3 ? 1.8 : 1;
    },
    // Subir de nivel: arpegio + acorde mantenido + brillo (antes 4 pitidos).
    nivel(c, d, t, r) {
      [523, 659, 784, 1047].forEach((f, i) => tono(c, d, t + i * 0.1, f * r, 0.18, { tipo: 'triangle', vol: 0.13 }));
      const t2 = t + 0.42;
      [523, 659, 784, 1047].forEach(f => { tono(c, d, t2, f * r, 1.3, { tipo: 'triangle', vol: 0.06, ataque: 0.02 }); tono(c, d, t2, f * r * 1.004, 1.3, { tipo: 'sine', vol: 0.04, ataque: 0.02 }); });
      tono(c, d, t2, 131 * r, 1.2, { tipo: 'sine', vol: 0.12, ataque: 0.02 });
      [2093, 2637, 3136].forEach((f, i) => campana(c, d, t2 + 0.05 + i * 0.09, f * r, 0.5, 0.05));
      soplo(c, d, t2, 1.1, { filtro: 'highpass', f: 7000, vol: 0.04, ataque: 0.1 });
      return 1.8;
    },
    // Logro: dos notas de metal suave y una campana.
    logro(c, d, t, r) {
      [[587, 0], [880, 0.14]].forEach(([f, dt]) => { tono(c, d, t + dt, f * r, 0.45, { tipo: 'sawtooth', vol: 0.035, ataque: 0.02 }); tono(c, d, t + dt, f * r, 0.45, { tipo: 'triangle', vol: 0.08, ataque: 0.02 }); });
      campana(c, d, t + 0.3, 1760 * r, 0.9, 0.1);
      return 1.3;
    },
    // Habilidad lanzada: whoosh de aire que sube y baja.
    hab(c, d, t, r) {
      soplo(c, d, t, 0.38, { f: 500 * r, f2: 2600 * r, q: 2.5, vol: 0.22, ataque: 0.08 });
      soplo(c, d, t + 0.16, 0.24, { f: 2400 * r, f2: 700 * r, q: 2, vol: 0.12, ataque: 0.02 });
      return 0.5;
    },
    // Curacion: campanitas que suben.
    cura(c, d, t, r) {
      [880, 1109, 1319, 1760].forEach((f, i) => campana(c, d, t + i * 0.075, f * r, 0.5, 0.08));
      soplo(c, d, t, 0.6, { filtro: 'highpass', f: 5000, vol: 0.03, ataque: 0.15 });
      return 0.9;
    },
    // Alas: dos aletazos suaves (ruido grave filtrado).
    alas(c, d, t, r) {
      soplo(c, d, t, 0.16, { filtro: 'lowpass', f: 900 * r, f2: 250, vol: 0.28, ataque: 0.04 });
      soplo(c, d, t + 0.2, 0.16, { filtro: 'lowpass', f: 800 * r, f2: 220, vol: 0.2, ataque: 0.04 });
      return 0.4;
    },
    // Caer al agua: chapuzon + golpe grave + gotitas.
    splash(c, d, t, r, o) {
      const k = o.fuerza || 0.6;
      soplo(c, d, t, 0.5 + k * 0.3, { filtro: 'highpass', f: 900 * r, f2: 3000, vol: 0.3 * k + 0.08, ataque: 0.008 });
      soplo(c, d, t, 0.25, { filtro: 'lowpass', f: 600 * r, f2: 150, vol: 0.25 * k + 0.05, ataque: 0.005 });
      for (let i = 0; i < 3 + Math.round(k * 3); i++) { const f = 900 + Math.random() * 1400; tono(c, d, t + 0.08 + Math.random() * 0.35, f, 0.07, { vol: 0.05, f2: f * 1.8 }); }
      return 0.9;
    },
    // Aterrizar fuerte: golpe sordo.
    aterriza(c, d, t, r, o) {
      const k = o.fuerza || 0.6;
      tono(c, d, t, 95 * r, 0.22, { vol: 0.35 * k + 0.1, f2: 40, ataque: 0.003 });
      soplo(c, d, t, 0.18, { filtro: 'lowpass', f: 500 * r, f2: 120, vol: 0.25 * k + 0.05, ataque: 0.003 });
      return 0.3;
    },
    // Ventana: clic suave (sube al abrir, baja al cerrar).
    clic(c, d, t, r, o) {
      tono(c, d, t, (o.cerrar ? 900 : 1300) * r, 0.05, { vol: 0.08, f2: (o.cerrar ? 600 : 1700) * r, ataque: 0.002 });
      soplo(c, d, t, 0.03, { filtro: 'highpass', f: 3000, vol: 0.04, ataque: 0.002 });
      return 0.1;
    },
  };
  // Separacion minima entre dos iguales (ms): evita que se amontonen.
  const SEPARA = { clic: 60, alas: 220, hab: 90, splash: 250, aterriza: 200, cofre: 300, botin: 250, nivel: 400, logro: 400, cura: 200 };

  // tocar('cofre', { vol, x, z, r }) — con x, z suena donde pasa.
  function tocar(nombre, o = {}) {
    if (!puede()) return;
    const c = ctx(), rec = RECETAS[nombre];
    if (!c || !rec || c.state === 'closed') return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    const ahora = performance.now();
    if (ahora - (ultimo[nombre] || 0) < (SEPARA[nombre] || 50)) return;
    if (voces >= MAX_VOCES) return;
    let vol = o.vol == null ? 1 : o.vol, pan = 0;
    if (o.x != null) { const p = pos(o.x, o.z); if (!p) return; vol *= p.vol; pan = p.pan; }
    if (vol < 0.02) return;
    ultimo[nombre] = ahora;
    try {
      const d = cadena(c, vol, pan);
      const dura = rec(c, d, c.currentTime + 0.01, variar(o.ancho), o) || 0.5;
      voces++; setTimeout(() => { voces = Math.max(0, voces - 1); try { d.disconnect(); } catch (e) {} }, dura * 1000 + 120);
    } catch (e) {}
  }
  return { tocar, pos, salida, variar };
}
