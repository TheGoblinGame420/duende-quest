"""Gameplay narrado de Duende Quest: clips reales + voz + sonido del juego + música.

    python scripts/gameplay_narrado.py                      (usa scripts/guion-gameplay.json)
    python scripts/gameplay_narrado.py otro-guion.json

Entrada (en _promo_kit/):
  raw/clipN_*.webm   clips de scripts/record-clips.mjs --dur=7000 --audio (con el sonido real del juego)
  musica.mp3         la canción (se usa el tramo con más energía)
  logo.png           el logo del cierre
  fuente.ttf         la fuente de los textos (League Gothic); si falta, Impact
  whoosh.wav / impacto.wav   efectos de corte (opcionales)

Cada frase del guion se dice con edge-tts (voz es-PE-AlexNeural) y dura lo que
dura la voz: el clip se corta a esa medida. Subtítulos por palabra (grupos de
hasta 3, las palabras "clave" en dorado), gancho arriba, barra de progreso y
cierre con el logo. Audio: voz + efectos del juego (bajan cuando hablo) + la
canción (baja más cuando hablo), normalizado a -14 LUFS. 1080x1920 a 60 fps.
"""
import asyncio, json, os, re, shutil, subprocess, sys, tempfile, wave
import numpy as np
import edge_tts

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT = os.path.join(REPO, "_promo_kit"); RAW = os.path.join(KIT, "raw")
cfg = json.load(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "scripts", "guion-gameplay.json"), encoding="utf-8"))
W, H, FPS, SR = 1080, 1920, 60, 48000
VOZ = cfg.get("voz", "es-PE-AlexNeural"); RATE = cfg.get("velocidad_voz", "+6%"); PITCH = cfg.get("tono_voz", "+0Hz")
TMP = tempfile.mkdtemp(prefix="dqnarr_")

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode: print(r.stderr[-3000:]); sys.exit(1)
    return r

if not shutil.which("ffmpeg"): sys.exit("Falta ffmpeg en el PATH")
fuente = next((f for f in [os.path.join(KIT, "fuente.ttf"), "C:/Windows/Fonts/impact.ttf"] if os.path.exists(f)), None)
if not fuente: sys.exit("No hay fuente: pon una .ttf en _promo_kit/fuente.ttf")
shutil.copy(fuente, os.path.join(TMP, "f.ttf"))
FF = os.path.join(TMP, "f.ttf").replace("\\", "/").replace(":", "\\:")
esc = lambda p: p.replace("\\", "/").replace(":", "\\:")

def leer_wav(p):
    with wave.open(p) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        return x.reshape(-1, w.getnchannels()).mean(1) if w.getnchannels() > 1 else x

def a_wav(src, dst, ss=None, t=None):
    cmd = ["ffmpeg", "-v", "error", "-y"] + (["-ss", f"{ss:.3f}"] if ss is not None else []) + (["-t", f"{t:.3f}"] if t else []) + ["-i", src, "-vn", "-ar", str(SR), "-ac", "1", dst]
    run(cmd); return leer_wav(dst)

async def tts(texto, mp3):
    com = edge_tts.Communicate(texto, VOZ, rate=RATE, pitch=PITCH, boundary="WordBoundary")
    pal = []
    with open(mp3, "wb") as f:
        async for ch in com.stream():
            if ch["type"] == "audio": f.write(ch["data"])
            elif ch["type"] == "WordBoundary": pal.append((ch["offset"] / 1e7, (ch["offset"] + ch["duration"]) / 1e7, ch["text"]))
    return pal

# ── 1) Voz por frase: duración exacta y tiempo de cada palabra ──
PAUSA = 0.15
voz, subs, segs, t = [], [], [], 0.0
for i, fr in enumerate(cfg["frases"]):
    mp3 = os.path.join(TMP, f"v{i}.mp3")
    pal = asyncio.run(tts(fr["texto"], mp3))
    x = a_wav(mp3, os.path.join(TMP, f"v{i}.wav"))
    nz = np.nonzero(np.abs(x) > 0.01)[0]; x = x[: nz[-1] + int(0.05 * SR)] if len(nz) else x
    dur = len(x) / SR + PAUSA + fr.get("extra", 0)
    voz.append((t, x)); segs.append((t, dur, fr))
    if not fr.get("sin_subtitulos"):
        toks = fr["texto"].split()
        if len(toks) == len(pal): pal = [(a, b, w) for (a, b, _), w in zip(pal, toks)]   # con la puntuación del guion
        grupo = []
        for j, (a, b, w) in enumerate(pal):
            grupo.append((a, b, w))
            if w[-1] in ",.?!:" or w.endswith("...") or len(grupo) == 3 or j == len(pal) - 1:
                subs.append([t + grupo[0][0], None, " ".join(g[2] for g in grupo).strip(" .,;:").upper()])
                grupo = []
    t += dur
TOTAL = t
for k, s in enumerate(subs):
    fin_frase = next(a + d for a, d, _ in segs if a <= s[0] < a + d)
    s[1] = min(subs[k + 1][0] if k + 1 < len(subs) else TOTAL, fin_frase)
CLAVE = {re.sub(r"\W", "", w).upper() for fr in cfg["frases"] for w in fr.get("clave", [])}
print(f"· voz lista: {len(segs)} frases, {TOTAL:.1f} s")

# ── 2) Audio: voz + efectos reales del juego + canción, con ducking ──
N = int((TOTAL + 0.2) * SR); vz = np.zeros(N); juego = np.zeros(N)
for t0, x in voz:
    i = int(t0 * SR); vz[i:i + len(x)] += x[: max(0, N - i)]
for k, (t0, d, fr) in enumerate(segs):
    if fr["clip"] == "fin" or fr.get("vel", 1.0) != 1.0: continue   # la cámara lenta va sin efectos (sonarían raros)
    try: y = a_wav(os.path.join(RAW, fr["clip"] + ".webm"), os.path.join(TMP, f"j{k}.wav"), fr.get("ss", 0), d)
    except SystemExit: continue
    i = int(t0 * SR); n = min(len(y), N - i, int(d * SR))
    rampa = np.minimum(1, np.minimum(np.arange(n), n - np.arange(n)) / (0.03 * SR))   # sin clics en los cortes
    juego[i:i + n] += y[:n] * rampa

# El tramo de la canción con más energía (sonoridad momentánea cada 0,1 s).
r = run(["ffmpeg", "-hide_banner", "-nostats", "-i", os.path.join(KIT, "musica.mp3"), "-af", "ebur128=metadata=1,ametadata=print:key=lavfi.r128.M:file=-", "-f", "null", "-"])
M = [(float(a), max(-70.0, float(b))) for a, b in re.findall(r"pts_time:([\d.]+)\s+lavfi\.r128\.M=(-?[\d.]+)", r.stdout)]
ts = np.array([m[0] for m in M]); ls = np.array([m[1] for m in M])
paso = max(1, int(round(0.5 / (ts[1] - ts[0]))))
cand = [(ls[(ts >= a) & (ts < a + TOTAL)].mean(), a) for a in ts[::paso] if a >= 5 and a + TOTAL < ts[-1] - 3]
ini = float(cfg.get("musica_inicio", max(cand)[1] if cand else 0))
mus = a_wav(os.path.join(KIT, "musica.mp3"), os.path.join(TMP, "mus.wav"), ini, TOTAL + 0.3)
mus = np.pad(mus, (0, max(0, N - len(mus))))[:N]
print(f"· música desde {ini:.1f} s")

hablo = np.convolve((np.abs(vz) > 0.01).astype(float), np.ones(int(0.25 * SR)), "same") > 0
suave = lambda g: np.convolve(g, np.ones(int(0.15 * SR)) / int(0.15 * SR), "same")
mix = vz * 1.0 + juego * suave(np.where(hablo, 0.35, 0.85)) + mus * suave(np.where(hablo, 0.13, 0.40))
def sfx(nombre, tt, g):
    p = os.path.join(KIT, nombre)
    if not os.path.exists(p): return
    s = a_wav(p, os.path.join(TMP, "s_" + nombre)); i = max(0, int(tt * SR)); j = min(N, i + len(s)); mix[i:j] += s[: j - i] * g
sfx("impacto.wav", 0, 0.5)
for t0, _, _ in segs[1:]: sfx("whoosh.wav", t0 - 0.22, 0.2)
mix *= np.minimum(np.minimum(np.arange(N) / (0.3 * SR), (N - np.arange(N)) / (0.8 * SR)), 1)   # entra y sale suave
mix = np.tanh(mix * 1.05) * 0.95
with wave.open(os.path.join(TMP, "mix.wav"), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())

# ── 3) Video ──
def txt(nombre, texto):
    p = os.path.join(TMP, nombre); open(p, "w", encoding="utf-8").write(texto); return esc(p)
def dt(texto_p, tam, y, color="white", extra=""):
    return (f"drawtext=fontfile='{FF}':textfile='{texto_p}':fontsize={tam}:fontcolor={color}:borderw=8:bordercolor=0x0a0418:"
            f"shadowcolor=black@0.6:shadowx=0:shadowy=6:x=(w-text_w)/2:y={y}{extra}")

ins, fc, et = [], [], []
for k, (t0, d, fr) in enumerate(segs):
    if fr["clip"] == "fin":
        # Cierre: el combate 2D desenfocado, el logo y el enlace.
        idx_bg = sum(1 for a in ins if a == "-i")
        ins += ["-ss", "0.5", "-t", f"{d + 0.2:.3f}", "-i", os.path.join(RAW, "clip2_2d_boss.webm")]
        idx_logo = idx_bg + 1
        ins += ["-loop", "1", "-framerate", str(FPS), "-t", f"{d + 0.2:.3f}", "-i", os.path.join(KIT, "logo.png")]
        c1, c2 = cfg.get("cta", ["JUEGA GRATIS EN", "DUENDEQUEST.COM/JUGAR"])
        fc.append(f"[{idx_bg}:v]fps={FPS},scale={W}:{H},setsar=1,gblur=sigma=28,eq=brightness=-0.2:saturation=1.2[bg{k}]")
        fc.append(f"[{idx_logo}:v]scale=560:560:flags=lanczos,format=rgba,fade=in:st=0:d=0.3:alpha=1[lg{k}]")
        fc.append(f"[bg{k}][lg{k}]overlay=x=(W-w)/2:y=470:shortest=1,"
                  + dt(txt(f"c1_{k}", c1), 96, 1080, extra=":alpha='min(1,t/0.2)'") + ","
                  + dt(txt(f"c2_{k}", c2), 112, 1180, color="0xffd84a", extra=":alpha='min(1,max(0,(t-0.25)/0.2))'") + ","
                  + dt(txt(f"c3_{k}", cfg.get("cta_sub", "")), 52, 1330, color="0xe8e2ff", extra=":borderw=5:alpha='min(1,max(0,(t-0.5)/0.3))'")
                  + f",trim=duration={d:.3f},setpts=PTS-STARTPTS,fade=in:st=0:d=0.12:color=white[s{k}]")
    else:
        vel = fr.get("vel", 1.0)
        idx = sum(1 for a in ins if a == "-i")
        ins += ["-ss", f"{fr.get('ss', 0):.3f}", "-t", f"{d * vel + 0.15:.3f}", "-i", os.path.join(RAW, fr["clip"] + ".webm")]
        fc.append(f"[{idx}:v]setpts=(PTS-STARTPTS)/{vel},fps={FPS},scale={W}:{H}:flags=lanczos,"
                  # punch-in al entrar (10 % que se suelta en 0,2 s)
                  f"scale=w='trunc({W}*(1+0.10*max(0,1-t*5))/2)*2':h=-2:eval=frame:flags=bicubic,crop={W}:{H},"
                  f"eq=contrast=1.06:saturation=1.12,setsar=1,trim=duration={d:.3f},setpts=PTS-STARTPTS[s{k}]")
    et.append(f"[s{k}]")
fc.append("".join(et) + f"concat=n={len(segs)}:v=1:a=0[base]")

f = [f"drawbox=x=0:y=0:w='iw*t/{TOTAL:.3f}':h=12:color=0xffd84a@1:t=fill"]
g = cfg.get("gancho")
if g:
    gt = cfg.get("gancho_dur", 2.8)
    for i, l in enumerate(g.split("\n")):
        f.append(dt(txt(f"g{i}", l), 124, 150 + i * 128, extra=f":enable='lt(t,{gt})'"))
Y_SUB = 560
for i, (a, b, s) in enumerate(subs):
    palabras = s.split(" ")
    dorado = any(re.sub(r"\W", "", p) in CLAVE for p in palabras)
    f.append(dt(txt(f"s{i}", s), 132, Y_SUB, color="0xffd84a" if dorado else "white",
                extra=f":enable='between(t,{a:.3f},{b:.3f})'"))
fc.append("[base]" + ",".join(f) + ",format=yuv420p[v]")
ia = sum(1 for a in ins if a == "-i")
ins += ["-i", os.path.join(TMP, "mix.wav")]
fc.append(f"[{ia}:a]loudnorm=I=-14:TP=-1.5:LRA=11,aresample={SR}[a]")

sal = os.path.join(REPO, cfg.get("salida", "_promo_kit/out/gameplay_narrado.mp4")); os.makedirs(os.path.dirname(sal), exist_ok=True)
fcf = os.path.join(TMP, "fc.txt"); open(fcf, "w", encoding="utf-8").write(";\n".join(fc))
run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex_script", fcf, "-map", "[v]", "-map", "[a]",
     "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-profile:v", "high", "-r", str(FPS), "-g", str(FPS), "-pix_fmt", "yuv420p",
     "-c:a", "aac", "-b:a", "192k", "-t", f"{TOTAL:.3f}", "-movflags", "+faststart", sal])
shutil.rmtree(TMP, ignore_errors=True)
print(f"· listo: {os.path.relpath(sal, REPO)} ({TOTAL:.1f} s)")
