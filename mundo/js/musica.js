// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — musica y sonido ambiente generados (WebAudio)
//
// Sin archivos: cada zona tiene su escala, su nota base y su ritmo; un bordon
// grave, acordes lentos y notas sueltas con eco. De noche suena mas bajo y
// mas lento. La lluvia es ruido filtrado y los truenos, ruido grave que se
// apaga. El AudioContext solo arranca tras un gesto del jugador.
//
// API: const M = crearMusica();  M.arrancar()  (en un clic/tecla)
//      M.zona(id)  M.noche(bool)  M.clima('lluvia'|'tormenta'|'nieve'|...)
//      M.trueno()  M.activo(bool)
// ═══════════════════════════════════════════════════════
const ESCALAS = {
  pueblo:      { raiz: 60, esc: [0, 2, 4, 7, 9], pulso: 0.62, onda: 'triangle' },
  amanecer:    { raiz: 62, esc: [0, 2, 4, 7, 9], pulso: 0.58, onda: 'triangle' },
  noche:       { raiz: 57, esc: [0, 3, 5, 7, 10], pulso: 0.8, onda: 'sine' },
  selva:       { raiz: 59, esc: [0, 3, 5, 7, 10], pulso: 0.5, onda: 'triangle' },
  tormenta:    { raiz: 55, esc: [0, 1, 5, 7, 8], pulso: 0.7, onda: 'sawtooth' },
  desierto:    { raiz: 57, esc: [0, 1, 4, 5, 7, 8, 10], pulso: 0.55, onda: 'triangle' },
  castillo:    { raiz: 55, esc: [0, 2, 3, 5, 7, 8, 11], pulso: 0.75, onda: 'sawtooth' },
  cumbres:     { raiz: 64, esc: [0, 2, 4, 6, 7, 9, 11], pulso: 0.7, onda: 'sine' },
  cavernas:    { raiz: 52, esc: [0, 3, 5, 6, 7, 10], pulso: 0.9, onda: 'sine' },
  abismo:      { raiz: 53, esc: [0, 2, 3, 5, 7, 8, 10], pulso: 0.85, onda: 'sine' },
  acantilados: { raiz: 62, esc: [0, 2, 4, 7, 9], pulso: 0.6, onda: 'triangle' },
};
const hz = n => 440 * Math.pow(2, (n - 69) / 12);

export function crearMusica() {
  let ctx = null, maestro = null, eco = null, lluviaG = null, vivo = false, activo = true;
  let zona = 'pueblo', noche = false, clima = 'despejado', reloj = 0, sigNota = 0, sigAcorde = 0, bordon = null;

  function arrancar() {
    // iPhone deja el contexto en 'interrupted' tras una llamada o al salir de Telegram: cualquier estado que no sea 'running' se retoma.
    if (ctx || !activo) { if (ctx && ctx.state !== 'running') { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    maestro = ctx.createGain(); maestro.gain.value = 0;
    maestro.connect(ctx.destination);
    // Eco suave (da "espacio" sin una reverb cara).
    eco = ctx.createDelay(1.5); eco.delayTime.value = 0.42;
    const vuelta = ctx.createGain(); vuelta.gain.value = 0.38;
    const filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 2200;
    eco.connect(filtro); filtro.connect(vuelta); vuelta.connect(eco); filtro.connect(maestro);
    // Lluvia: ruido blanco en bucle, filtrado.
    const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const ruido = ctx.createBufferSource(); ruido.buffer = buf; ruido.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.6;
    lluviaG = ctx.createGain(); lluviaG.gain.value = 0;
    ruido.connect(bp); bp.connect(lluviaG); lluviaG.connect(ctx.destination);
    ruido.start();
    ctx._ruido = buf;
    vivo = true;
    reloj = ctx.currentTime + 0.2; sigNota = reloj; sigAcorde = reloj;
    cambiarBordon();
    volumen();
    setInterval(programar, 200);
  }
  function volumen() {
    if (!ctx) return;
    const t = ctx.currentTime;
    maestro.gain.cancelScheduledValues(t);
    maestro.gain.linearRampToValueAtTime(activo ? (noche ? 0.07 : 0.1) : 0, t + 1.5);
    lluviaG.gain.cancelScheduledValues(t);
    const ll = !activo ? 0 : clima === 'tormenta' ? 0.07 : clima === 'lluvia' ? 0.045 : clima === 'arena' ? 0.03 : 0;
    lluviaG.gain.linearRampToValueAtTime(ll, t + 2);
  }
  function nota(n, cuando, dura, vol, onda, alEco) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = onda; o.frequency.value = hz(n);
    g.gain.setValueAtTime(0, cuando);
    g.gain.linearRampToValueAtTime(vol, cuando + Math.min(0.08, dura * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0008, cuando + dura);
    if (onda === 'sawtooth') { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; o.connect(f); f.connect(g); } else o.connect(g);
    g.connect(maestro); if (alEco) g.connect(eco);
    o.start(cuando); o.stop(cuando + dura + 0.05);
  }
  // Bordon: dos osciladores graves algo desafinados, filtrados.
  function cambiarBordon() {
    if (!ctx) return;
    const t = ctx.currentTime, E = ESCALAS[zona] || ESCALAS.pueblo;
    if (bordon) { const b = bordon; b.g.gain.linearRampToValueAtTime(0, t + 2.5); setTimeout(() => { try { b.o1.stop(); b.o2.stop(); } catch (e) {} }, 3000); }
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o1.type = o2.type = 'sawtooth'; o1.frequency.value = hz(E.raiz - 24); o2.frequency.value = hz(E.raiz - 24) * 1.006;
    f.type = 'lowpass'; f.frequency.value = 260;
    g.gain.value = 0; g.gain.linearRampToValueAtTime(0.11, t + 3);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(maestro);
    o1.start(); o2.start();
    bordon = { o1, o2, g };
  }
  function programar() {
    if (!vivo || !activo) return;
    const E = ESCALAS[zona] || ESCALAS.pueblo;
    const pulso = E.pulso * (noche ? 1.35 : 1);
    const hasta = ctx.currentTime + 0.6;
    // Tras una pausa (Telegram minimizado, sonido apagado, segundo plano) no se recupera
    // lo perdido: el bucle creaba cientos de osciladores de golpe al volver (tiron).
    if (sigNota < ctx.currentTime) sigNota = ctx.currentTime + 0.05;
    if (sigAcorde < ctx.currentTime) sigAcorde = ctx.currentTime + 0.05;
    // Tras un rato sin programar (segundo plano, silencio) no se tocan de golpe
    // todas las notas atrasadas: se sigue desde ahora.
    if (sigNota < ctx.currentTime) sigNota = ctx.currentTime + 0.05;
    if (sigAcorde < ctx.currentTime) sigAcorde = ctx.currentTime + 0.05;
    while (sigNota < hasta) {
      // Melodia: notas de la escala, a veces silencio; mas espaciada de noche.
      if (Math.random() < (noche ? 0.45 : 0.62)) {
        const i = Math.floor(Math.random() * E.esc.length), oct = Math.random() < 0.3 ? 12 : 0;
        nota(E.raiz + E.esc[i] + oct, sigNota, pulso * (1.5 + Math.random() * 2), 0.11, E.onda === 'sawtooth' ? 'triangle' : E.onda, true);
      }
      sigNota += pulso * (Math.random() < 0.25 ? 2 : 1);
    }
    while (sigAcorde < hasta) {
      // Acorde lento de tres notas de la escala (grado 1, 3 y 5).
      const g = Math.floor(Math.random() * E.esc.length);
      for (const k of [0, 2, 4]) nota(E.raiz - 12 + E.esc[(g + k) % E.esc.length] + (g + k >= E.esc.length ? 12 : 0), sigAcorde, pulso * 12, 0.045, E.onda, false);
      sigAcorde += pulso * 12;
    }
  }
  function trueno() {
    if (!ctx || !activo) return;
    const t = ctx.currentTime + 0.3 + Math.random() * 1.2;
    const src = ctx.createBufferSource(); src.buffer = ctx._ruido;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start(t, Math.random()); src.stop(t + 2.8);
  }
  return {
    arrancar,
    zona(id) { if (id === zona) return; zona = id; if (ctx) cambiarBordon(); },
    noche(v) { if (v === noche) return; noche = v; volumen(); },
    clima(c) { if (c === clima) return; clima = c; volumen(); },
    trueno,
    // Silenciada, tras bajar el volumen se suspende el contexto: el bordon y la
    // lluvia dejan de gastar bateria aunque no se oigan.
    activo(v) { activo = v; if (v) arrancar(); volumen(); if (!v && ctx) setTimeout(() => { if (!activo && ctx.state === 'running') ctx.suspend().catch(() => {}); }, 1600); },
  };
}
