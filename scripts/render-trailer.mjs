// ═══════════════════════════════════════════════════════
// Paso 3 del trailer: monta _promo_kit/out/trailer_final.mp4 (15 s, H.264,
// 60 fps) con los clips de scripts/record-clips.mjs.
//
//   node scripts/render-trailer.mjs
//   node scripts/render-trailer.mjs --inicio=62.5      (segundo de la canción)
//   node scripts/render-trailer.mjs --cta="JUEGA GRATIS EN|DUENDEQUEST.COM"
//
// Estructura:
//   0.0–2.5   clip1_3d_fly      zoom progresivo + "UN MMORPG GRATIS SIN DESCARGAR"
//   2.5–6.0   clip2_2d_boss     "JUEGA EN 3D Y 2D CON EL MISMO PERSONAJE"
//   6.0–10.0  clip3_3d_pvp      "EXPLORA, CAPTURA Y DOMINA MAZMORRAS"
//  10.0–12.5  clip4_2d_capture  "EN CELULAR, PC O TELEGRAM"
//  12.5–15.0  CTA: juego desenfocado + _promo_kit/logo.png + texto
//
// Música: _promo_kit/musica.mp3. Si no se da --inicio, se busca el tramo de
// 15 s con más energía (sonoridad EBU R128), con fade-in 0,5 s, fade-out
// 1,5 s y volumen normalizado a −14 LUFS.
// El tamaño sale de los clips: vertical 1080x1920 u horizontal 1920x1080.
// Fuente: _promo_kit/fuente.ttf si existe; si no, Impact de Windows.
// (drawtext necesita fontfile explícito: fontconfig falla en esta máquina.)
// ═══════════════════════════════════════════════════════
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KIT = path.join(REPO, '_promo_kit');
const RAW = path.join(KIT, 'raw'), OUT = path.join(KIT, 'out');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
// La raíz duendequest.com abre la página del token; el juego está en /jugar.
const CTA = arg('cta', 'JUEGA GRATIS EN|DUENDEQUEST.COM/JUGAR').split('|');
const DUR = 15, FPS = 60;

const ok = (cmd, args, txt) => { const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28 }); if (r.status !== 0) { console.error(txt || cmd, '\n', (r.stderr || '').slice(-2500)); process.exit(1); } return r; };
if (spawnSync('ffmpeg', ['-version']).status !== 0 || spawnSync('ffprobe', ['-version']).status !== 0) { console.error('Falta ffmpeg/ffprobe en el PATH. En Windows: winget install Gyan.FFmpeg'); process.exit(1); }

const CLIPS = ['clip1_3d_fly', 'clip2_2d_boss', 'clip3_3d_pvp', 'clip4_2d_capture'].map(n => path.join(RAW, n + '.webm'));
for (const f of [...CLIPS, path.join(KIT, 'musica.mp3'), path.join(KIT, 'logo.png')]) if (!fs.existsSync(f)) { console.error('Falta', path.relative(REPO, f), '(graba con scripts/record-clips.mjs)'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const [W, H] = ok('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', CLIPS[0]]).stdout.trim().split(',').map(Number);
const V = H > W, u = Math.min(W, H) / 1080;   // unidad: 1 px a 1080 de ancho corto
console.log(`· formato ${W}x${H} (${V ? 'vertical' : 'horizontal'})`);

// ── Fuente (ruta escapada para drawtext: C\:/...) ──
const fuente = [path.join(KIT, 'fuente.ttf'), 'C:/Windows/Fonts/impact.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'].find(f => fs.existsSync(f));
if (!fuente) { console.error('No hay fuente: pon una .ttf en _promo_kit/fuente.ttf'); process.exit(1); }
const ff = fuente.replace(/\\/g, '/').replace(/:/g, '\\:');

// ── Tramo de la canción con más energía ──
let inicio = arg('inicio', null);
if (inicio === null) {
  // Sonoridad momentánea cada 0,1 s (metadata del filtro ebur128 impresa por stdout).
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', path.join(KIT, 'musica.mp3'), '-af', 'ebur128=metadata=1,ametadata=print:key=lavfi.r128.M:file=-', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const M = [...(r.stdout || '').matchAll(/pts_time:([\d.]+)\s+lavfi\.r128\.M=(-?[\d.]+)/g)].map(m => [+m[1], Math.max(-70, +m[2])]);
  if (M.length < 200) { console.error('No pude medir la música; usa --inicio=SEGUNDOS'); process.exit(1); }
  let mejor = 0, mejorV = -1e9;
  for (let i = 0; i < M.length; i++) {
    const t0 = M[i][0];
    if (t0 < 5 || t0 + DUR > M.at(-1)[0] - 3) continue;   // ni el arranque ni el final
    if (Math.abs(t0 * 2 - Math.round(t0 * 2)) > 0.01) continue;   // cada 0,5 s
    let s = 0, n = 0;
    for (let j = i; j < M.length && M[j][0] < t0 + DUR; j++) { s += M[j][1]; n++; }
    const v = s / Math.max(1, n);
    if (v > mejorV) { mejorV = v; mejor = t0; }
  }
  inicio = mejor;
  console.log(`· música desde ${(+inicio).toFixed(1)} s (sonoridad media ${mejorV.toFixed(1)} LUFS)`);
}

// ── Textos ──
// Cada línea es su propio drawtext (centrada de verdad). Entra con un fundido
// de 0,15 s; contorno oscuro grueso y sombra. Los textos van en archivos para
// no pelear con el escapado de comas y dos puntos de ffmpeg.
const TXT = path.join(OUT, '_textos'); fs.mkdirSync(TXT, { recursive: true });
let nTxt = 0;
function textos(lineas, { y0, tam, color = 'white', t0 = 0 }) {
  return lineas.map((l, i) => {
    const f = path.join(TXT, `t${nTxt++}.txt`); fs.writeFileSync(f, l, 'utf8');
    const tf = f.replace(/\\/g, '/').replace(/:/g, '\\:');
    return `drawtext=fontfile='${ff}':textfile='${tf}':fontsize=${Math.round(tam)}:fontcolor=${color}:borderw=${Math.round(7 * u)}:bordercolor=0x0a0418:shadowcolor=black@0.6:shadowx=0:shadowy=${Math.round(6 * u)}:x=(w-text_w)/2:y=${Math.round(y0 + i * tam * 1.02)}:alpha='min(1,max(0,(t-${t0})/0.15))'`;
  }).join(',');
}
const TAM = (V ? 118 : 96) * u, Y_TXT = V ? H * 0.115 : H * 0.07;
// Partir en líneas que quepan (vertical: ~16 caracteres; horizontal: una línea).
const partir = (s, max) => { if (!V) return [s]; const out = []; let l = ''; for (const p of s.split(' ')) { if (l && (l + ' ' + p).length > max) { out.push(l); l = p; } else l = l ? l + ' ' + p : p; } if (l) out.push(l); return out; };

const SEG = [
  { clip: 0, dur: 2.5, desde: 0.2, txt: 'UN MMORPG GRATIS SIN DESCARGAR', zoom: true },
  { clip: 1, dur: 3.5, desde: 0.2, txt: 'JUEGA EN 3D Y 2D CON EL MISMO PERSONAJE' },
  { clip: 2, dur: 4.0, desde: 0.0, txt: 'EXPLORA, CAPTURA Y DOMINA MAZMORRAS' },
  { clip: 3, dur: 2.5, desde: 1.0, txt: 'EN CELULAR, PC O TELEGRAM' },
];
// Los clips duran 4 s: el tramo pedido no puede pasar del final.
for (const s of SEG) s.desde = Math.max(0, Math.min(s.desde, 4 - s.dur - 0.02));

// ── Grafo de filtros ──
const fc = [];
SEG.forEach((s, i) => {
  let v = `[${s.clip}:v]trim=start=${s.desde}:duration=${s.dur},setpts=PTS-STARTPTS,fps=${FPS},scale=${W}:${H}:flags=lanczos,setsar=1`;
  // Zoom-in progresivo (1.00 → 1.14) recortando al centro; sin zoompan (tiembla).
  if (s.zoom) v += `,scale=w='trunc(${W}*(1+0.14*t/${s.dur})/2)*2':h='trunc(${H}*(1+0.14*t/${s.dur})/2)*2':eval=frame:flags=bicubic,crop=${W}:${H}`;
  v += `,fade=in:st=0:d=0.12:color=white`;   // destello corto en cada corte
  v += ',' + textos(partir(s.txt, 16), { y0: Y_TXT, tam: TAM, t0: 0.05 });
  fc.push(v + `[v${i}]`);
});
// CTA: el combate 2D desenfocado y oscuro, el logo que entra y el texto.
const CTA_D = DUR - SEG.reduce((a, s) => a + s.dur, 0);
const LOGO = Math.round((V ? 560 : 420) * u);
fc.push(`[1:v]trim=start=0.3:duration=${CTA_D},setpts=PTS-STARTPTS,fps=${FPS},scale=${W}:${H},setsar=1,gblur=sigma=${Math.round(28 * u)},eq=brightness=-0.18:saturation=1.2[ctaf]`);
fc.push(`[5:v]scale=${LOGO}:${LOGO}:flags=lanczos,format=rgba,fade=in:st=0:d=0.3:alpha=1[logo]`);
const yLogo = V ? Math.round(H * 0.25) : Math.round(H * 0.12);
const yCta = yLogo + LOGO + Math.round(40 * u);
fc.push(`[ctaf][logo]overlay=x=(W-w)/2:y=${yLogo}:shortest=0,` + textos([CTA[0]], { y0: yCta, tam: TAM * 0.8, t0: 0.15 }) + ',' + textos(CTA.slice(1), { y0: yCta + TAM * 0.85, tam: TAM * (V ? 0.92 : 1), color: '0xffd84a', t0: 0.3 }) + `,fade=in:st=0:d=0.12:color=white[v4]`);
fc.push(`[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0,format=yuv420p[v]`);
fc.push(`[4:a]atrim=start=${inicio}:duration=${DUR},asetpts=PTS-STARTPTS,loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=in:st=0:d=0.5,afade=t=out:st=${DUR - 1.5}:d=1.5,aresample=48000[a]`);

const sal = path.join(OUT, 'trailer_final.mp4');
const t = Date.now();
ok('ffmpeg', ['-v', 'error', '-y',
  ...CLIPS.flatMap(c => ['-i', c]), '-i', path.join(KIT, 'musica.mp3'), '-loop', '1', '-framerate', String(FPS), '-t', String(CTA_D), '-i', path.join(KIT, 'logo.png'),
  '-filter_complex', fc.join(';'), '-map', '[v]', '-map', '[a]',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', String(FPS),
  '-maxrate', V ? '20M' : '24M', '-bufsize', '40M',
  '-c:a', 'aac', '-b:a', '192k', '-t', String(DUR), '-movflags', '+faststart', sal], 'ffmpeg falló al montar el trailer');
fs.rmSync(TXT, { recursive: true, force: true });
const info = ok('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,bit_rate:stream=codec_name,width,height,r_frame_rate', '-of', 'compact=p=0', sal]).stdout.trim();
console.log(`· listo en ${((Date.now() - t) / 1000).toFixed(0)} s → ${path.relative(REPO, sal)}\n${info}`);
