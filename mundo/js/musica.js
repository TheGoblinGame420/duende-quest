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
//      M.trueno()  M.activo(bool)  M.tic()  (toque suave de la interfaz)
//
// Ambiente (v321): viento que sube y baja en las alturas y el Abismo, pajaros de
// dia en el pueblo y la selva, grillos de noche y gotas con eco en las cavernas.
//
// Musica andina (v339): quena y zampoña (seno + soplo de aire + vibrato), charango
// (rasgueo brillante y corto) y bombo legüero. Cada zona tiene su MOTIVO de pocas
// notas que se repite y varia (respuesta, duo de zampoñas en terceras, adorno) sobre
// una progresion de acordes; las capas entran y salen cada 4 compases. Al cambiar de
// zona se cruzan las dos musicas en 2,5 s. API extra:
//      M.combate(true)  sube el pulso y suma percusion; vuelve sola a la calma (~6 s)
//      M.evento(id)     'tanta2026' / 'cosecha2026': fiesta andina en el pueblo
// Todo sale por un compresor: nada satura aunque suenen muchas capas a la vez.
// ═══════════════════════════════════════════════════════
// Progresiones (raiz en semitonos sobre la tonica + 'M' mayor / 'm' menor).
const P_MAY = [[0, 'M'], [5, 'M'], [7, 'M'], [9, 'm']];      // I-IV-V-vi
const P_AND = [[0, 'm'], [3, 'M'], [10, 'M'], [0, 'm']];     // i-III-VII-i (el giro andino)
const P_MEN = [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']];     // i-VI-III-VII
const P_FRI = [[0, 'm'], [1, 'M'], [0, 'm'], [8, 'M']];
const P_ARM = [[0, 'm'], [5, 'm'], [7, 'M'], [0, 'm']];
const P_LID = [[0, 'M'], [2, 'M'], [0, 'M'], [7, 'M']];
// Motivos: [grado de la escala, duracion en semicorcheas]; 32 = dos compases.
// ins: quena (clara), zampona (mas aire), suave (casi sin soplo). capas: c charango, b bombo.
const ESCALAS = {
  pueblo:      { raiz: 62, esc: [0, 2, 4, 7, 9], bpm: 96, prog: P_MAY, ins: 'quena', capas: 'cb',
    motivo: [[4, 2], [3, 1], [3, 1], [2, 2], [3, 2], [4, 4], [2, 4], [1, 2], [2, 1], [2, 1], [1, 2], [0, 2], [0, 8]] },
  amanecer:    { raiz: 64, esc: [0, 2, 4, 7, 9], bpm: 84, prog: P_MAY, ins: 'quena', capas: 'c',
    motivo: [[0, 4], [2, 2], [4, 2], [5, 6], [4, 2], [3, 4], [2, 4], [1, 4], [0, 4]] },
  noche:       { raiz: 57, esc: [0, 3, 5, 7, 10], bpm: 66, prog: P_AND, ins: 'zampona', capas: '', cada: 2,
    motivo: [[2, 4], [1, 2], [0, 2], [-1, 8], [0, 4], [1, 4], [2, 8]] },
  selva:       { raiz: 59, esc: [0, 3, 5, 7, 10], bpm: 100, prog: P_AND, ins: 'quena', capas: 'cb',
    motivo: [[0, 2], [2, 1], [3, 1], [4, 2], [3, 2], [2, 3], [0, 1], [2, 4], [3, 2], [2, 1], [1, 1], [0, 4], [-1, 2], [0, 6]] },
  tormenta:    { raiz: 55, esc: [0, 1, 5, 7, 8], bpm: 88, prog: P_FRI, ins: 'zampona', capas: 'b',
    motivo: [[0, 4], [1, 4], [0, 2], [4, 2], [3, 4], [2, 4], [1, 4], [0, 8]] },
  desierto:    { raiz: 57, esc: [0, 1, 4, 5, 7, 8, 10], bpm: 80, prog: P_FRI, ins: 'zampona', capas: 'b',
    motivo: [[4, 3], [5, 1], [4, 2], [3, 2], [2, 4], [1, 2], [2, 2], [1, 2], [0, 2], [1, 4], [0, 8]] },
  castillo:    { raiz: 55, esc: [0, 2, 3, 5, 7, 8, 11], bpm: 76, prog: P_ARM, ins: 'zampona', capas: 'b',
    motivo: [[0, 4], [2, 4], [4, 4], [6, 2], [7, 2], [6, 4], [4, 4], [3, 4], [2, 4]] },
  cumbres:     { raiz: 64, esc: [0, 2, 4, 6, 7, 9, 11], bpm: 70, prog: P_LID, ins: 'zampona', capas: '', cada: 2,
    motivo: [[4, 6], [3, 2], [2, 4], [1, 4], [0, 8], [3, 4], [2, 4]] },
  cavernas:    { raiz: 52, esc: [0, 3, 5, 6, 7, 10], bpm: 60, prog: P_MEN, ins: 'suave', capas: '', cada: 2,
    motivo: [[0, 8], [2, 4], [3, 4], [1, 12], [0, 4]] },
  abismo:      { raiz: 53, esc: [0, 2, 3, 5, 7, 8, 10], bpm: 64, prog: P_MEN, ins: 'suave', capas: '', cada: 2,
    motivo: [[4, 6], [5, 2], [4, 4], [2, 4], [3, 8], [1, 4], [0, 4]] },
  acantilados: { raiz: 62, esc: [0, 2, 4, 7, 9], bpm: 90, prog: P_MAY, ins: 'quena', capas: 'cb',
    motivo: [[0, 2], [1, 2], [2, 2], [4, 2], [5, 4], [4, 2], [2, 2], [3, 4], [2, 2], [1, 2], [0, 8]] },
};
// Fiestas de temporada: en el pueblo cambian la musica por una de fiesta andina.
const FIESTAS = {
  // T'anta Wawa: huayno en menor, alegre pero con su pena (Todos los Santos).
  tanta2026:   { raiz: 57, esc: [0, 3, 5, 7, 10], bpm: 104, prog: P_AND, ins: 'quena',
    motivo: [[4, 2], [3, 1], [3, 1], [2, 2], [1, 2], [2, 2], [1, 1], [1, 1], [0, 4], [2, 2], [1, 1], [1, 1], [0, 2], [-1, 2], [0, 8]] },
  // Cosecha: carnavalito en mayor, saltadito.
  cosecha2026: { raiz: 62, esc: [0, 2, 4, 7, 9], bpm: 112, prog: P_MAY, ins: 'quena',
    motivo: [[4, 1], [4, 1], [4, 2], [5, 2], [4, 2], [2, 2], [3, 2], [4, 4], [3, 1], [3, 1], [3, 2], [2, 2], [1, 2], [0, 2], [1, 2], [0, 4]] },
};
// Rasgueo del charango por semicorchea: 1 hacia abajo (acento), 2 hacia arriba.
const RASGUEO = [1, 0, 0, 2, 1, 0, 2, 0, 1, 0, 0, 2, 1, 0, 2, 0];
const RASG_FIESTA = [1, 0, 2, 1, 0, 2, 1, 2, 1, 0, 2, 1, 0, 2, 1, 2];
// Capas por seccion (cada 4 compases): acordes, melodia, charango, bombo.
const SECCIONES = [[1, 1, 0, 0], [1, 1, 1, 0.6], [0.8, 1, 1, 1], [1, 0.55, 0.35, 0]];
const hz = n => 440 * Math.pow(2, (n - 69) / 12);

// opc.ligera (moviles flojos): charango de una cuerda con filtro compartido, menos
// rasgueos, quena sin capa de ruido y menos chajchas en combate. M.ligera(v) lo cambia.
export function crearMusica(opc = {}) {
  let ligera = !!opc.ligera;
  const curvas = new Map();   // vibrato por duracion (decimas de s): no se crea un Float32Array por nota
  const bucles = {};          // ruidos en bucle (lluvia, viento): se paran si llevan rato en silencio
  let ctx = null, maestro = null, salida = null, eco = null, lluviaG = null, vivo = false, activo = true;
  let zona = 'pueblo', noche = false, clima = 'despejado', reloj = 0;
  let vientoG = null, vientoF = null, ambG = null, sigAmb = 0;
  // Secuenciador: semicorcheas (n16), frase en curso, capas y combate.
  let bus = null, sigPaso = 0, n16 = 0, frase = [], resto = 0, vari = 0, acorde = 0;
  let evento = '', toquePend = '', combG = null, furia = 0, furiaHasta = 0;
  // Peligro (vida baja): filtro que apaga los agudos y latido grave; agachar = baja ante premios.
  let peligroF = null, peligroK = 0, sigLatido = 0, remateHasta = 0;
  const capa = { acor: 1, mel: 1, cha: 0, bom: 0 }, capaAnt = { acor: 1, mel: 1, cha: 0, bom: 0 };
  const VIENTO = { cumbres: 0.05, abismo: 0.06, acantilados: 0.045, tormenta: 0.04, desierto: 0.03, castillo: 0.02 };
  const PAJAROS = { pueblo: 1, amanecer: 1, selva: 1.4, acantilados: 0.6 };

  function arrancar() {
    // iPhone deja el contexto en 'interrupted' tras una llamada o al salir de Telegram: cualquier estado que no sea 'running' se retoma.
    if (ctx || !activo) { if (ctx && ctx.state !== 'running') { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    // Compresor a la salida: muchas capas juntas (o un trueno) nunca saturan el altavoz.
    salida = ctx.createDynamicsCompressor();
    salida.threshold.value = -16; salida.knee.value = 10; salida.ratio.value = 4; salida.attack.value = 0.004; salida.release.value = 0.3;
    salida.connect(ctx.destination);
    maestro = ctx.createGain(); maestro.gain.value = 0;
    peligroF = ctx.createBiquadFilter(); peligroF.type = 'lowpass'; peligroF.frequency.value = 20000 - peligroK * 19000; peligroF.Q.value = 0.7;
    maestro.connect(peligroF); peligroF.connect(salida);
    combG = ctx.createGain(); combG.gain.value = 0; combG.connect(maestro);
    // Eco suave (da "espacio" sin una reverb cara).
    eco = ctx.createDelay(1.5); eco.delayTime.value = 0.42;
    const vuelta = ctx.createGain(); vuelta.gain.value = 0.38;
    const filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 2200;
    eco.connect(filtro); filtro.connect(vuelta); vuelta.connect(eco); filtro.connect(maestro);
    // Lluvia: ruido blanco en bucle, filtrado.
    const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.6;
    lluviaG = ctx.createGain(); lluviaG.gain.value = 0;
    bp.connect(lluviaG); lluviaG.connect(salida);
    ctx._ruido = buf;
    bucles.lluvia = { s: null, entrada: bp, rate: 1, cero: 0 };
    // Viento: el mismo ruido, grave y con un filtro que se mueve despacio.
    vientoF = ctx.createBiquadFilter(); vientoF.type = 'lowpass'; vientoF.frequency.value = 420; vientoF.Q.value = 2.2;
    vientoG = ctx.createGain(); vientoG.gain.value = 0;
    vientoF.connect(vientoG); vientoG.connect(salida);
    bucles.viento = { s: null, entrada: vientoF, rate: 0.5, cero: 0 };
    ambG = ctx.createGain(); ambG.gain.value = 0; ambG.connect(salida); ambG.connect(eco);
    vivo = true;
    reloj = ctx.currentTime + 0.2; sigPaso = reloj;
    volumen();
    setInterval(programar, 200);
  }
  function volumen() {
    if (!ctx) return;
    const t = ctx.currentTime;
    maestro.gain.cancelScheduledValues(t);
    maestro.gain.linearRampToValueAtTime(activo ? (noche ? 0.08 : 0.11) : 0, t + 1.5);
    lluviaG.gain.cancelScheduledValues(t);
    const ll = !activo ? 0 : clima === 'tormenta' ? 0.07 : clima === 'lluvia' ? 0.045 : clima === 'arena' ? 0.03 : 0;
    lluviaG.gain.linearRampToValueAtTime(ll, t + 2);
    bucle('lluvia', ll > 0);
    vientoG.gain.cancelScheduledValues(t);
    const vv = activo ? (VIENTO[zona] || 0.012) * (clima === 'tormenta' ? 1.8 : 1) : 0;
    vientoG.gain.linearRampToValueAtTime(vv, t + 2.5);
    bucle('viento', vv > 0);
    ambG.gain.cancelScheduledValues(t);
    ambG.gain.linearRampToValueAtTime(activo ? 0.5 : 0, t + 1.5);
  }
  // Ruido en bucle: suena mientras su volumen sea > 0; si queda en 0 (rampa de ~2 s + 5 s
  // de silencio), podarBucles lo para y se vuelve a crear al subir. Asi la lluvia no gasta CPU con cielo despejado.
  function bucle(nom, on) {
    const b = bucles[nom];
    if (!b || !ctx) return;
    if (!on) { if (!b.cero) b.cero = ctx.currentTime; return; }
    b.cero = 0;
    if (b.s) return;
    const s = ctx.createBufferSource(); s.buffer = ctx._ruido; s.loop = true; s.playbackRate.value = b.rate;
    s.connect(b.entrada); s.start(ctx.currentTime, Math.random() * 1.5); b.s = s;
  }
  function podarBucles() {
    const t = ctx.currentTime;
    for (const k in bucles) {
      const b = bucles[k];
      if (b.s && b.cero && t - b.cero > 7.5) { try { b.s.stop(); b.s.disconnect(); } catch (e) {} b.s = null; }
    }
  }
  // Sonidos de la naturaleza, cada uno corto y al azar.
  function pajaro(t) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f0 = 2200 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 4);
    o.type = 'sine';
    for (let i = 0; i < n; i++) {
      const a = t + i * 0.11;
      o.frequency.setValueAtTime(f0, a); o.frequency.exponentialRampToValueAtTime(f0 * (1.25 + Math.random() * 0.4), a + 0.06);
      g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(0.035, a + 0.015); g.gain.linearRampToValueAtTime(0, a + 0.08);
    }
    o.connect(g); g.connect(ambG); o.start(t); o.stop(t + n * 0.11 + 0.1);
  }
  function grillo(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 4300 + Math.random() * 500;
    g.gain.value = 0;
    for (let i = 0; i < 6; i++) { const a = t + i * 0.045; g.gain.setValueAtTime(0.012, a); g.gain.setValueAtTime(0, a + 0.022); }
    o.connect(g); g.connect(ambG); o.start(t); o.stop(t + 0.3);
  }
  function gota(t) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f0 = 900 + Math.random() * 900;
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.45, t + 0.12);
    g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.25);
    o.connect(g); g.connect(ambG); o.start(t); o.stop(t + 0.3);
  }
  function ambiente() {
    if (!ambG) return;
    const t = ctx.currentTime;
    // El viento sopla a rachas.
    vientoF.frequency.setTargetAtTime(300 + Math.random() * 500, t, 1.2);
    if (sigAmb > t + 8 || sigAmb < t - 1) sigAmb = t + 0.5;
    if (sigAmb > t + 0.25) return;
    const lluvia = clima === 'lluvia' || clima === 'tormenta';
    if (zona === 'cavernas' || zona === 'abismo') { gota(t + Math.random() * 0.2); sigAmb = t + 0.8 + Math.random() * 2.4; }
    else if (noche) { if (!lluvia) for (let i = 0; i < 2; i++) grillo(t + i * 0.5 + Math.random() * 0.1); sigAmb = t + 1.4 + Math.random() * 1.8; }
    else if (PAJAROS[zona] && !lluvia) { pajaro(t + Math.random() * 0.3); sigAmb = t + (2.5 + Math.random() * 5) / PAJAROS[zona]; }
    else sigAmb = t + 3;
  }
  // Toque de la interfaz: un "tic" corto y suave, como el de un telefono.
  function tic(alto) {
    if (!ctx || !activo || ctx.state !== 'running') return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(alto ? 1500 : 1100, t); o.frequency.exponentialRampToValueAtTime(alto ? 900 : 650, t + 0.04);
    g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.06);
    o.connect(g); g.connect(salida); o.start(t); o.stop(t + 0.08);
  }
  // ── Instrumentos ──
  // Quena / zampoña: seno con un toque de armonico, entrada con "deslizado" hacia la
  // nota, soplo de aire filtrado y vibrato que entra despacio. aire 0..1.
  function soplo(n, t, dur, vol, dest, aire) {
    dur = Math.min(3, Math.max(0.12, dur));
    const f = hz(n), fin = t + dur, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain();
    o.type = 'sine'; o2.type = 'triangle';
    o.frequency.setValueAtTime(f * 0.985, t); o.frequency.linearRampToValueAtTime(f, t + 0.05);
    o2.frequency.setValueAtTime(f * 1.97, t); o2.frequency.linearRampToValueAtTime(f * 2, t + 0.05);
    g2.gain.value = aire > 0.5 ? 0.07 : 0.16;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.06, dur * 0.25));
    g.gain.linearRampToValueAtTime(vol * 0.82, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, fin + 0.12);
    if (dur > 0.35) {
      // Vibrato en cents (curva: sin osciladores extra que dejar vivos).
      // Guardada por duracion en decimas de segundo (como mucho ~30 curvas en toda la partida).
      const k = Math.round(dur * 10), largo = k / 10 - 0.15;
      let c = curvas.get(k);
      if (!c) {
        const N = Math.max(8, Math.ceil(largo * 60)); c = new Float32Array(N);
        for (let i = 0; i < N; i++) { const tt = i / (N - 1) * largo; c[i] = 9 * Math.min(1, tt / 0.3) * Math.sin(6.283 * 5.3 * tt); }
        curvas.set(k, c);
      }
      try { o.detune.setValueCurveAtTime(c, t + 0.15, largo); o2.detune.setValueCurveAtTime(c, t + 0.15, largo); } catch (e) {}
    }
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(dest);
    o.start(t); o2.start(t); o.stop(fin + 0.15); o2.stop(fin + 0.15);
    // Ligera: sin capa de ruido en la melodia de fondo (el remate y el toque de fiesta, que salen por maestro, si la llevan).
    if (aire > 0.05 && !(ligera && dest !== maestro)) {
      // Soplo: ruido en banda cerca de la nota, fuerte al atacar y luego un hilo.
      const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain(), va = vol * aire;
      s.buffer = ctx._ruido; bp.type = 'bandpass'; bp.frequency.value = Math.min(9000, f * (aire > 0.5 ? 1.2 : 1.6)); bp.Q.value = aire > 0.5 ? 0.9 : 1.6;
      ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(va * 0.9, t + 0.025); ng.gain.linearRampToValueAtTime(va * 0.22, t + 0.14);
      ng.gain.linearRampToValueAtTime(0, fin + 0.08);
      s.connect(bp); bp.connect(ng); ng.connect(dest); s.start(t, Math.random() * 1.5); s.stop(fin + 0.12);
    }
  }
  // Charango: cuerdas dobles (una algo desafinada), brillo que se apaga rapido.
  function cuerda(n, t, vol, dest) {
    if (ligera) {
      // Una sola cuerda triangular y un filtro compartido por bus (se crea una vez): 2 nodos por nota en vez de 5.
      let lp = dest._lpLig;
      if (!lp) { lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.2; lp.frequency.value = 2600; lp.connect(dest); dest._lpLig = lp; }
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = hz(n);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * 1.15, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.38);
      o.connect(g); g.connect(lp); o.start(t); o.stop(t + 0.4);
      return;
    }
    const f = hz(n), o = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f; o2.type = 'sawtooth'; o2.frequency.value = f * 1.004; g2.gain.value = 0.35;
    lp.type = 'lowpass'; lp.Q.value = 1.5; lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(1300, t + 0.14);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.42);
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(dest);
    o.start(t); o2.start(t); o.stop(t + 0.45); o2.stop(t + 0.45);
  }
  function rasgueo(notas, t, vol, dest, abajo) {
    // Hacia arriba solo rozan las agudas (y menos nodos en movil); en ligera, solo la grave.
    const ns = abajo ? notas : ligera ? notas.slice(0, 1) : notas.slice(1).reverse();
    ns.forEach((n, i) => cuerda(n, t + i * 0.013, vol * (1 - i * 0.12), dest));
  }
  // Golpe de ruido filtrado (parche, aro, chajchas, caja).
  function ruidoGolpe(t, tipo, fr, q, vol, caida, dest) {
    if (vol < 0.001) return;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = ctx._ruido; f.type = tipo; f.frequency.value = fr; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + caida);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + caida + 0.02);
  }
  // Bombo legüero: cuero grave que cae de tono + el golpe del parche.
  function bombo(t, vol, dest) {
    if (vol < 0.001) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.55);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.6);
    ruidoGolpe(t, 'lowpass', 650, 0.7, vol * 0.3, 0.07, dest);
  }
  const aro = (t, vol, dest) => ruidoGolpe(t, 'bandpass', 2600, 3, vol, 0.04, dest);       // golpe de madera del legüero
  const chajchas = (t, vol, dest) => ruidoGolpe(t, 'highpass', 6500, 0.7, vol, 0.09, dest);  // sonaja de pezuñas
  function caja(t, vol, dest) {
    ruidoGolpe(t, 'bandpass', 1700, 0.8, vol, 0.14, dest);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    g.gain.setValueAtTime(vol * 0.6, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.1);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.12);
  }
  // Acorde suave (colchon) y bajo.
  function colchon(notas, t, dur, vol, dest) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1300; f.connect(dest);
    notas.forEach((n, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = hz(n); o.detune.value = (i - 1) * 4;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.25);
      g.gain.linearRampToValueAtTime(vol * 0.7, t + dur * 0.75); g.gain.linearRampToValueAtTime(0, t + dur + 0.4);
      o.connect(g); g.connect(f); o.start(t); o.stop(t + dur + 0.45);
    });
  }
  function bajo(n, t, dur, vol, dest) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = hz(n); f.type = 'lowpass'; f.frequency.value = 420;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0008, t + Math.max(0.15, dur));
    o.connect(f); f.connect(g); g.connect(dest); o.start(t); o.stop(t + Math.max(0.15, dur) + 0.05);
  }
  // ── Armonia ──
  const nGrado = (E, g) => { const L = E.esc.length, o = Math.floor(g / L); return E.raiz + E.esc[((g % L) + L) % L] + 12 * o; };
  function notasAcorde(E, i, base) {
    const [r, q] = E.prog[i % E.prog.length];
    return (q === 'M' ? [0, 4, 7] : [0, 3, 7]).map(x => { let n = E.raiz + r + x; while (n < base) n += 12; while (n >= base + 12) n -= 12; return n; }).sort((a, b) => a - b);
  }
  // ── Zonas: cada una en su propio bus, para cruzarlas al cambiar ──
  function idConf() { return zona === 'pueblo' && FIESTAS[evento] ? 'pueblo:' + evento : ESCALAS[zona] ? zona : 'pueblo'; }
  function confDe(id) {
    if (id.indexOf(':') > 0) return { ...ESCALAS.pueblo, ...FIESTAS[id.split(':')[1]], capas: 'cb', fiesta: true };
    return ESCALAS[id];
  }
  function cambiarBus(id) {
    const t = ctx.currentTime, viejo = bus, E = confDe(id);
    if (viejo) {
      viejo.g.gain.cancelScheduledValues(t); viejo.g.gain.setValueAtTime(viejo.g.gain.value, t); viejo.g.gain.linearRampToValueAtTime(0, t + 2.5);
      setTimeout(() => { try { viejo.o1.stop(); viejo.o2.stop(); viejo.g.disconnect(); viejo.mel.disconnect(); } catch (e) {} }, 3600);
    }
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + (viejo ? 2.5 : 1.5)); g.connect(maestro);
    const capaG = v => { const x = ctx.createGain(); x.gain.value = v; x.connect(g); return x; };
    const b = { id, E, g, acor: capaG(1), mel: capaG(1), cha: capaG(0), bom: capaG(0) };
    b.mel.connect(eco);
    // Bordon: dos osciladores graves algo desafinados, filtrados (mas tenue en fiesta).
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), bg = ctx.createGain();
    o1.type = o2.type = 'sawtooth'; o1.frequency.value = hz(E.raiz - 24); o2.frequency.value = hz(E.raiz - 24) * 1.006;
    f.type = 'lowpass'; f.frequency.value = 240; bg.gain.value = E.fiesta ? 0.03 : 0.07;
    o1.connect(f); o2.connect(f); f.connect(bg); bg.connect(g); o1.start(); o2.start();
    b.o1 = o1; b.o2 = o2;
    bus = b; frase = []; resto = 0; vari = 0;
    secciones(t, Math.floor(n16 / 16));
  }
  // Capas que entran y salen cada 4 compases (de noche, menos percusion).
  function secciones(t, compas) {
    const E = bus.E, T = SECCIONES[E.fiesta ? 2 : Math.floor(compas / 4) % 4], nk = noche && !E.fiesta;
    const meta = { acor: T[0], mel: T[1], cha: E.capas.includes('c') ? T[2] * (nk ? 0.6 : 1) : 0, bom: E.capas.includes('b') ? T[3] * (nk ? 0.4 : 1) : 0 };
    for (const k in meta) { capaAnt[k] = capa[k]; capa[k] = meta[k]; bus[k].gain.setTargetAtTime(meta[k], t, 1.2); }
  }
  const viva = k => capa[k] > 0 || capaAnt[k] > 0;
  // Frase siguiente a partir del motivo: tal cual, respuesta que vuelve a casa,
  // duo de zampoñas en terceras, y una libre (o un respiro de silencio).
  function nuevaFrase(E) {
    const M = E.motivo, v = vari++ % 4;
    if (v === 0) return M.map(([g, l]) => [g, l, '']);
    if (v === 1) { const f = M.map(([g, l]) => [g + 1, l, '']); f[f.length - 1][0] = 0; return f; }
    if (v === 2) return M.map(([g, l]) => [g, l, 'duo']);
    if (!E.fiesta && (noche || Math.random() < 0.3)) return [[null, 32, '']];
    return M.map(([g, l], i) => [i > 0 && i < M.length - 1 && Math.random() < 0.25 ? g + (Math.random() < 0.5 ? -1 : 1) : g, l, E.fiesta && i % 4 === 0 ? 'duo' : '']);
  }
  function tocarMel(E, g, t, dur, modo) {
    const n = nGrado(E, g), ins = modo === 'duo' ? 'zampona' : E.ins;
    if (ins === 'suave') soplo(n, t, dur * 1.3, 0.085, bus.mel, 0.12);
    else soplo(n, t, dur * 0.95 + 0.04, ins === 'zampona' ? 0.095 : 0.085, bus.mel, ins === 'zampona' ? 0.75 : 0.35);
    if (modo === 'duo') soplo(nGrado(E, g + 2), t, dur * 0.95, 0.05, bus.mel, 0.6);
  }
  // Una semicorchea de musica en el instante t (d = duracion de la semicorchea).
  function paso(t, d) {
    const E = bus.E, p = n16 % 16, compas = Math.floor(n16 / 16);
    if (p === 0) {
      if (compas % 4 === 0) secciones(t, compas);
      const cada = E.cada || 1;
      if (compas % cada === 0) {
        acorde = Math.floor(compas / cada) % E.prog.length;
        colchon(notasAcorde(E, acorde, E.raiz - 12), t, d * 16 * cada, 0.032, bus.acor);
      }
      const rb = notasAcorde(E, acorde, E.raiz - 24)[0];
      bajo(rb, t, d * 7, 0.1, bus.acor);
      if (E.capas || E.fiesta) bajo(rb + 7, t + d * 8, d * 7, 0.07, bus.acor);
    }
    // Melodia: el motivo nota a nota.
    if (resto > 0) resto--;
    else {
      if (!frase.length) frase = nuevaFrase(E);
      const [g, l, modo] = frase.shift();
      if (g !== null && capa.mel > 0) tocarMel(E, g, t, l * d, modo);
      resto = l - 1;
    }
    // Charango: rasgueo de huayno sobre el acorde.
    if (viva('cha')) { const r = (E.fiesta ? RASG_FIESTA : RASGUEO)[p]; if (r && !(ligera && E.fiesta && r !== 1)) rasgueo(notasAcorde(E, acorde, E.raiz), t, r === 1 ? 0.05 : 0.032, bus.cha, r === 1); }
    // Bombo legüero: "tum ... tum-tum" con el aro de madera en los contratiempos.
    if (viva('bom')) {
      if (p === 0) bombo(t, 0.34, bus.bom); else if (p === 8) bombo(t, 0.26, bus.bom); else if (p === 10) bombo(t, 0.16, bus.bom);
      if (p === 4 || p === 12) aro(t, 0.045, bus.bom);
      if (E.fiesta && p % 4 === 2) chajchas(t, 0.03, bus.bom);
    }
    // Combate: pulso de bombo en cada tiempo, caja, chajchas y bajo insistente.
    if (furia > 0.03) {
      const v = Math.min(1, furia), rb = notasAcorde(E, acorde, E.raiz - 24)[0];
      if (p % 4 === 0) bombo(t, 0.32 * v, combG);
      if (p === 4 || p === 12) caja(t, 0.1 * v, combG);
      if (p % 2 === 1 && (!ligera || p % 4 === 3)) chajchas(t, (p % 4 === 3 ? 0.045 : 0.025) * v, combG);
      if (p % 2 === 0) bajo(rb + (p % 4 === 2 ? 12 : 0), t, d * 1.6, 0.09 * v, combG);
    }
  }
  // Toque de fiesta al empezar un evento: subida de quena, bombo y rasgueo final.
  function toqueFiesta(id) {
    const F = { ...ESCALAS.pueblo, ...FIESTAS[id] }, t = ctx.currentTime + 0.25, d = 0.11;
    [[0, 1], [1, 1], [2, 1], [4, 1], [5, 3], [4, 1], [5, 5]].reduce((a, [g, l]) => { soplo(nGrado(F, g), t + a * d, l * d, 0.1, maestro, 0.4); return a + l; }, 0);
    bombo(t, 0.3, maestro); bombo(t + 4 * d, 0.24, maestro); bombo(t + 8 * d, 0.34, maestro);
    rasgueo(notasAcorde(F, 0, F.raiz), t + 8 * d, 0.06, maestro, true);
    for (let i = 0; i < 12; i++) chajchas(t + i * d, 0.03, maestro);
  }
  // Remate: al caer un jefe, frase de quena en la escala y el acorde que suenan, triple bombo y rasgueo.
  function remate(tipo) {
    if (!ctx || !activo || !maestro || ctx.state !== 'running') return false;
    const E = bus ? bus.E : ESCALAS.pueblo, t = ctx.currentTime + 0.08, d = tipo === 'jefe' ? 0.1 : 0.085;
    const r = E.prog[acorde % E.prog.length][0] % 12, gi = E.esc.indexOf(r), g0 = gi >= 0 ? gi : 0;   // arranca en la raiz del acorde que suena
    [[g0, 1], [g0 + 1, 1], [g0 + 2, 1], [g0 + 3, 1], [g0 + 4, 2], [g0 + 5, 6]].reduce((a, [g, l]) => { soplo(nGrado(E, g), t + a * d, l * d, 0.11, maestro, 0.4); return a + l; }, 0);
    soplo(nGrado(E, g0 + 3), t + 6 * d, 6 * d, 0.05, maestro, 0.6);   // segunda voz: la zampona en tercera
    bombo(t + 4 * d, 0.3, maestro); bombo(t + 5 * d, 0.3, maestro); bombo(t + 6 * d, 0.4, maestro);
    rasgueo(notasAcorde(E, acorde, E.raiz), t + 6 * d, 0.065, maestro, true);
    for (let i = 0; i < 8; i++) chajchas(t + i * d, 0.03, maestro);
    remateHasta = t + 13 * d;   // agachar no lo tapa (el botin del jefe llega a la vez)
    furiaHasta = 0;   // la pelea termino: la percusion de combate se apaga sola
    return true;
  }
  // Baja la musica unos segundos para que se oiga la recompensa, y vuelve despacio.
  function agachar(seg) {
    if (!ctx || !maestro || !activo || ctx.currentTime < remateHasta) return;
    const t = ctx.currentTime, base = activo ? (noche ? 0.08 : 0.11) : 0;
    seg = Math.max(0.3, Math.min(5, +seg || 1.5));
    maestro.gain.cancelScheduledValues(t); maestro.gain.setValueAtTime(maestro.gain.value, t);
    maestro.gain.setTargetAtTime(base * 0.35, t, 0.03);
    maestro.gain.setTargetAtTime(base, t + seg, 0.4);
  }
  // k 0..1: cuanto peligro (vida baja). 0 = musica limpia; 1 = apagada y con latido.
  function peligro(k) {
    k = Math.max(0, Math.min(1, +k || 0));
    peligroK = k;
    if (!ctx || !peligroF) return;
    peligroF.frequency.setTargetAtTime(20000 - k * 19000, ctx.currentTime, k > 0 ? 0.25 : 0.6);
  }
  function latido(t, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.2);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.35);
    o.connect(g); g.connect(maestro); o.start(t); o.stop(t + 0.4);
  }
  function programar() {
    if (!vivo || !activo) return;
    ambiente(); podarBucles();
    const ahora = ctx.currentTime, hasta = ahora + 0.7;
    const id = idConf();
    if (!bus || bus.id !== id) cambiarBus(id);
    // El toque solo suena en la fiesta del pueblo (si no, se perdia y sonaba al salir del pueblo, tras el tema MP3).
    if (toquePend && ctx.state === 'running') { const tp = toquePend; toquePend = ''; if (id.indexOf(':') > 0) toqueFiesta(tp); }
    // Combate: sube rapido y baja sola unos segundos despues del ultimo golpe.
    const meta = ahora < furiaHasta ? 1 : 0;
    furia += (meta - furia) * (meta > furia ? 0.4 : 0.2);   // ~3 s de bajada tras los 3 s de espera: calma a los ~6 s
    if (furia < 0.01) furia = 0;
    combG.gain.setTargetAtTime(furia, ahora, 0.25);
    // Vida baja: latido grave y suave cada ~0,8 s (como un corazon que se acelera).
    if (peligroK > 0.5 && ctx.state === 'running') {
      if (sigLatido < ahora || sigLatido > ahora + 2) sigLatido = ahora + 0.05;
      while (sigLatido < hasta) { latido(sigLatido, 0.22 + 0.16 * (peligroK - 0.5)); sigLatido += 0.8; }
    }
    // Tras una pausa (Telegram minimizado, sonido apagado, segundo plano) no se recupera
    // lo perdido: el bucle creaba cientos de osciladores de golpe al volver (tiron).
    if (sigPaso < ahora) sigPaso = ahora + 0.05;
    const E = bus.E, d = 60 / E.bpm / 4 * (noche && !E.fiesta ? 1.18 : 1) / (1 + 0.16 * furia);
    while (sigPaso < hasta) { paso(sigPaso, d); sigPaso += d; n16++; }
  }
  function trueno() {
    if (!ctx || !activo) return;
    const t = ctx.currentTime + 0.3 + Math.random() * 1.2;
    const src = ctx.createBufferSource(); src.buffer = ctx._ruido;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
    src.connect(f); f.connect(g); g.connect(salida);
    src.start(t, Math.random()); src.stop(t + 2.8);
  }
  return {
    arrancar,
    // El cruce entre la musica vieja y la nueva lo hace programar() (cambiarBus).
    zona(id) { if (id === zona) return; zona = id; if (ctx) volumen(); },
    // Pelea: on = sube el pulso y entra la percusion; sin golpes, a la calma sola.
    combate(on) { if (!ctx) return; furiaHasta = on ? ctx.currentTime + 3 : 0; },
    // Temporada activa ('tanta2026', 'cosecha2026'...): fiesta en el pueblo + toque al empezar.
    evento(id) { id = id || ''; if (id === evento) return; evento = id; if (FIESTAS[id]) toquePend = id; },
    tic,
    remate, agachar, peligro,
    // Modo ligero (moviles flojos / resolucion dinamica): menos nodos de audio por segundo.
    ligera(v) { ligera = !!v; },
    noche(v) { if (v === noche) return; noche = v; volumen(); },
    clima(c) { if (c === clima) return; clima = c; volumen(); },
    trueno,
    // Silenciada, tras bajar el volumen se suspende el contexto: el bordon y la
    // lluvia dejan de gastar bateria aunque no se oigan.
    activo(v) { activo = v; if (v) arrancar(); volumen(); if (!v && ctx) setTimeout(() => { if (!activo && ctx.state === 'running') ctx.suspend().catch(() => {}); }, 1600); },
  };
}
