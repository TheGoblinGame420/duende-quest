"""Paso 2 del video promocional: musica, rotulos, montaje y exportacion.

    python tools/promo/montar.py          (usa las tomas de promo/_trabajo/tomas)
    python tools/promo/montar.py --hojas  (solo hojas de contacto para elegir cortes)

Entradas: promo/_trabajo/tomas/*.mp4 (de grabar.mjs), audio/sfx/*.ogg (CC0,
ver CREDITOS.md) y assets/ui/icon-512.png. La musica la compone musica.py.
Salidas (fuera del sitio publicado; promo/ esta en .gitignore y .assetsignore):
    promo/duende_quest_promo_30s.mp4            1080x1920, 30 fps, H.264 + AAC
    promo/duende_quest_promo_30s_cuadrado.mp4   1080x1080 (feed de Facebook)
    promo/portada.png                           1080x1920

Zona segura de los rotulos (IG/TikTok tapan arriba y abajo): y 250..1520 y
60 px a los lados en vertical.
"""
import json
import os
import re
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
PROMO = os.path.join(RAIZ, 'promo')
TRAB = os.path.join(PROMO, '_trabajo')
TOMAS = os.path.join(TRAB, 'tomas')
PIEZAS = os.path.join(TRAB, 'piezas')
ROT = os.path.join(TRAB, 'rotulos')
FUENTES = 'C:/Windows/Fonts/'
NEGRA = FUENTES + 'seguibl.ttf'      # Segoe UI Black
NEGRITA = FUENTES + 'segoeuib.ttf'   # Segoe UI Bold
EMOJI = FUENTES + 'seguiemj.ttf'     # Segoe UI Emoji (color)
FPS = 30
DURACION = 30.0

ORO = (255, 216, 74)
BLANCO = (255, 255, 255)
AZUL = (37, 99, 235)
MORADO = (147, 51, 234)
CIAN = (34, 211, 238)

# ── Guion (tiempos en multiplos de 0,4 s = un tiempo de la musica a 150 BPM) ──
# Cada parte: (toma, segundo de inicio dentro de la toma, duracion, rotulo pequeño)
ESCENAS = [
    dict(id='gancho', titulo=['UN MMORPG', 'EN TU MÓVIL'], antetitulo='DUENDE QUEST', sub='Pixel art · online · sin descargas',
         partes=[('gancho', 0.6, 2.4, None)], sfx=[(0.0, 'explosion', 0.9), (0.55, 'corte', 0.5), (1.3, 'corte2', 0.5)]),
    dict(id='clases', titulo=['4 CLASES'], sub=None,
         partes=[('clase_guerrero', 1.6, 1.2, ('🛡️ Guerrero', (199, 156, 110))), ('clase_mago', 3.6, 1.2, ('🔥 Mago', (105, 204, 240))),
                 ('clase_sacerdote', 1.6, 1.2, ('✨ Sacerdote', (245, 245, 245))), ('clase_picaro', 0.2, 1.2, ('🗡️ Pícaro', (255, 245, 105)))],
         sfx=[(0.0, 'corte', 0.6), (1.2, 'corte2', 0.5), (2.4, 'corte', 0.5), (3.6, 'corte2', 0.5)]),
    dict(id='mazmorra', titulo=['MAZMORRAS', 'CON JEFES'], sub='Solo o en grupo de 4',
         partes=[('mazmorra', 1.0, 4.8, None)], sfx=[(0.0, 'explosion', 0.7), (2.2, 'golpe', 0.5), (4.3, 'muerte', 0.7), (4.5, 'moneda', 0.6)]),
    dict(id='online', titulo=['JUEGA ONLINE'], sub='Grupos, chat y duelos ⚔️',
         partes=[('online', 2.0, 4.0, None)], sfx=[(0.0, 'corte', 0.6), (1.6, 'golpe', 0.5)]),
    dict(id='eventos', titulo=['MONTURAS, SETS', 'Y EVENTOS'], sub=None,
         partes=[('halloween_montura', 0.3, 1.6, ('🐉 Monturas · 🎃 Halloween', (255, 154, 60))), ('sets', 0.6, 1.2, ('🛡️ Sets de equipo', (249, 115, 22))),
                 ('navidad_montura', 0.6, 1.2, ('🎄 Navidad', (74, 222, 128)))],
         sfx=[(0.0, 'corte', 0.6), (1.6, 'boton', 0.6), (2.8, 'corte2', 0.5)]),
    dict(id='arcade', titulo=['+ MODO ARCADE'], sub='Partidas rápidas',
         partes=[('arcade', 1.0, 1.6, None)], sfx=[(0.0, 'salto', 0.6), (0.8, 'corte', 0.5)]),
    dict(id='chicha', titulo=['JUNTA PUNTOS', 'JUGANDO'], sub='y gana un litro de chicha morada 🥤',
         nota='Promoción. Puntos con cuenta de Telegram, desde Nv 10. Condiciones en el juego.',
         partes=[('chicha_caza', 1.6, 1.6, None), ('chicha_panel', 0.4, 2.4, None)],
         sfx=[(0.0, 'moneda', 0.6), (0.5, 'moneda', 0.5), (1.0, 'moneda', 0.5), (1.6, 'boton', 0.6)]),
]
CTA_DUR = 4.4   # 25,6 .. 30,0
CTA_FONDO = ('mazmorra', 0.5)

# Encuadre de las tomas verticales del MMO (1080x1920, suelo en y~1360):
# zoom 1,2 anclado en el suelo para que los personajes se vean mas grandes.
ZOOM = 1.2
SUELO_Y = 1360


def sh(args, **kw):
    r = subprocess.run(args, **kw)
    if r.returncode != 0:
        raise SystemExit('falló: ' + ' '.join(map(str, args))[:300])
    return r


def duracion(f):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True)
    return float(r.stdout.strip() or 0)


def tam(f):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f], capture_output=True, text=True)
    w, h = r.stdout.strip().split(',')
    return int(w), int(h)


# ════════════════ ROTULOS (Pillow) ════════════════
_cache = {}


def fuente(ruta, t):
    k = (ruta, t)
    if k not in _cache:
        _cache[k] = ImageFont.truetype(ruta, t)
    return _cache[k]


VS16 = chr(0xFE0F)   # selector de variante: Segoe lo dibuja con ancho propio
ES_EMOJI = re.compile('[\U0001F000-\U0001FAFF\u2600-\u27BF\u2B50]')


def trozos(txt):
    """Separa texto y emoji (con su selector de variante / ZWJ)."""
    out, i = [], 0
    while i < len(txt):
        if ES_EMOJI.match(txt[i]):
            j = i + 1
            while j < len(txt) and (txt[j] in '\uFE0F\u200D' or (txt[j - 1] == '\u200D')):
                j += 1
            out.append((True, txt[i:j].replace(VS16, '')))
            i = j
        else:
            j = i
            while j < len(txt) and not ES_EMOJI.match(txt[j]):
                j += 1
            out.append((False, txt[i:j]))
            i = j
    return out


def ancho_linea(txt, ruta, t):
    f, fe = fuente(ruta, t), fuente(EMOJI, int(t * 0.86))
    return sum((fe.getlength(s) if e else f.getlength(s)) for e, s in trozos(txt))


def linea(capa, txt, cx, y, ruta, t, color, borde=0, color_borde=(10, 8, 20), max_ancho=960):
    """Dibuja una linea centrada en cx (y = parte de arriba). Encoge si no cabe."""
    while ancho_linea(txt, ruta, t) > max_ancho and t > 20:
        t -= 2
    f, fe = fuente(ruta, t), fuente(EMOJI, int(t * 0.86))
    d = ImageDraw.Draw(capa)
    x = cx - ancho_linea(txt, ruta, t) / 2
    mb = f.getbbox('M')
    centro = y + (mb[1] + mb[3]) / 2
    for e, s in trozos(txt):
        if e:
            eb = fe.getbbox(s)
            d.text((x, centro - (eb[1] + eb[3]) / 2), s, font=fe, embedded_color=True)
            x += fe.getlength(s)
        else:
            d.text((x, y), s, font=f, fill=color, stroke_width=borde, stroke_fill=color_borde)
            x += f.getlength(s)
    return t


def con_sombra(capa, radio=7, desp=(0, 8), opacidad=170):
    """Sombra suave debajo de todo lo que tenga la capa."""
    a = capa.split()[3]
    sombra = Image.new('RGBA', capa.size, (0, 0, 0, 0))
    negro = Image.new('RGBA', capa.size, (0, 0, 0, opacidad))
    sombra.paste(negro, desp, a)
    sombra = sombra.filter(ImageFilter.GaussianBlur(radio))
    sombra.alpha_composite(capa)
    return sombra


def pastilla(capa, txt, cx, y, t, fondo, color_txt=BLANCO, ruta=NEGRITA, pad=(34, 16), alfa=235, max_ancho=940):
    while ancho_linea(txt, ruta, t) + pad[0] * 2 > max_ancho and t > 20:
        t -= 2
    w = ancho_linea(txt, ruta, t) + pad[0] * 2
    f = fuente(ruta, t)
    asc, desc = f.getmetrics()
    h = asc + desc + pad[1] * 2 - int(t * 0.25)
    d = ImageDraw.Draw(capa)
    d.rounded_rectangle([cx - w / 2, y, cx + w / 2, y + h], radius=h / 2, fill=fondo + (alfa,))
    linea(capa, txt, cx, y + pad[1] - int(t * 0.2), ruta, t, color_txt, max_ancho=max_ancho)
    return y + h


def oscuro_para(rgb):
    return (20, 16, 30) if sum(rgb) > 450 else BLANCO


def rotulo(esc, chip, formato, primero):
    """PNG transparente con el rotulo de una parte de escena."""
    W, H = (1080, 1920) if formato == 'v' else (1080, 1080)
    capa = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    cx = W // 2
    y = 300 if formato == 'v' else 56
    grande = 128 if formato == 'v' else 100
    if esc.get('antetitulo'):
        y = pastilla(capa, esc['antetitulo'], cx, y, 46 if formato == 'v' else 38, (0, 0, 0), ORO, NEGRA, alfa=150) + 18
    for i, l in enumerate(esc['titulo']):
        color = ORO if (i == len(esc['titulo']) - 1 and len(esc['titulo']) > 1) else BLANCO
        t = linea(capa, l, cx, y, NEGRA, grande, color, borde=11 if formato == 'v' else 9)
        y += int(t * 1.12)
    if esc.get('sub'):
        y += 14
        y = pastilla(capa, esc['sub'], cx, y, 50 if formato == 'v' else 42, (12, 10, 24), BLANCO, alfa=205) + 14
    if chip:
        txt, col = chip
        y += 10
        y = pastilla(capa, txt, cx, y, 58 if formato == 'v' else 46, col, oscuro_para(col), NEGRA, alfa=245) + 10
    if esc.get('nota'):
        f_y = (1462 if formato == 'v' else 1012)
        pastilla(capa, esc['nota'], cx, f_y, 32 if formato == 'v' else 26, (0, 0, 0), (230, 230, 240), NEGRITA, pad=(22, 10), alfa=175, max_ancho=960)
    return con_sombra(capa)


def icono(lado):
    """Icono del juego sin su fondo negro (solo el medallon redondo)."""
    im = Image.open(os.path.join(RAIZ, 'assets', 'ui', 'icon-512.png')).convert('RGBA')
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).ellipse((54, 50, 460, 456), fill=255)
    im.putalpha(m)
    im = im.crop((54, 50, 460, 456))
    return im.resize((lado, lado), Image.LANCZOS)


def tarjeta_final(formato):
    """Tres capas (aparecen escalonadas) de la tarjeta final."""
    W, H = (1080, 1920) if formato == 'v' else (1080, 1080)
    cx = W // 2
    capas = [Image.new('RGBA', (W, H), (0, 0, 0, 0)) for _ in range(3)]
    v = formato == 'v'
    y = 300 if v else 60
    lado = 280 if v else 190
    capas[0].alpha_composite(icono(lado), (cx - lado // 2, y))
    y += lado + (20 if v else 6)
    t = linea(capas[0], 'DUENDE QUEST', cx, y, NEGRA, 132 if v else 104, (255, 230, 0), borde=10)
    y += int(t * 1.18)
    y2 = y
    t = linea(capas[1], 'Juega gratis · Sin descargas', cx, y2, NEGRA, 62 if v else 52, BLANCO, borde=7)
    y2 += int(t * 1.3)
    t = linea(capas[1], 'En Telegram y en el navegador', cx, y2, NEGRITA, 52 if v else 44, (210, 225, 255), borde=6)
    y2 += int(t * 1.6) + (10 if v else 0)
    y3 = pastilla(capas[2], '✈️ @duendequest_bot', cx, y2, 60 if v else 50, (34, 158, 217), BLANCO, NEGRA, pad=(40, 20), alfa=255)
    y3 += 26 if v else 18
    pastilla(capas[2], 'duende-quest.alfonso12hc.workers.dev', cx, y3, 42 if v else 38, (15, 18, 32), (255, 216, 74), NEGRITA, pad=(30, 16), alfa=235, max_ancho=960)
    return [con_sombra(c) for c in capas]


# ════════════════ VIDEO (ffmpeg) ════════════════
def filtro_toma(toma, formato):
    """Encuadre de una toma: crop + escala con vecino mas cercano (pixel nitido)."""
    w, h = tam(os.path.join(TOMAS, toma + '.mp4'))
    if w > h:   # arcade (horizontal): banda central sobre un fondo desenfocado
        if formato == 'v':
            return ('split[a][b];[a]scale=-2:1920:flags=neighbor,crop=1080:1920,boxblur=18:2,colorchannelmixer=rr=0.62:gg=0.62:bb=0.62[f];'
                    '[b]crop=1300:1080:310:0,scale=1080:-2:flags=neighbor[c];[f][c]overlay=0:700')
        return ('split[a][b];[a]scale=-2:1080:flags=neighbor,crop=1080:1080,boxblur=18:2,colorchannelmixer=rr=0.62:gg=0.62:bb=0.62[f];'
                '[b]crop=1600:1080:160:0,scale=1080:-2:flags=neighbor[c];[f][c]overlay=0:330')
    # Paneles del juego (premio de chicha, equipo): se recorta la parte util
    # y se pone bajo el rotulo, sobre la misma toma desenfocada.
    panel_y = {'chicha_panel': 420, 'sets': 300}.get(toma)
    if formato == 'v':
        if panel_y is not None:
            return (f'split[a][b];[a]boxblur=20:2,colorchannelmixer=rr=0.5:gg=0.5:bb=0.5[f];[b]crop=1080:800:0:{panel_y},scale=886:-2:flags=neighbor[c];'
                    '[f][c]overlay=97:770')
        cw, ch = round(1080 / ZOOM), round(1920 / ZOOM)
        x0, y0 = (1080 - cw) // 2, round(SUELO_Y * (1 - 1 / ZOOM))
        return f'crop={cw}:{ch}:{x0}:{y0},scale=1080:1920:flags=neighbor'
    if panel_y is not None:
        return (f'split[a][b];[a]crop=1080:1080:0:420,boxblur=20:2,colorchannelmixer=rr=0.5:gg=0.5:bb=0.5[f];[b]crop=1080:800:0:{panel_y},scale=-2:620:flags=neighbor[c];'
                '[f][c]overlay=(W-w)/2:375')
    return f'crop=900:900:90:{SUELO_Y + 110 - 900},scale=1080:1080:flags=neighbor'


# Color: las fotos de Chrome son JPEG (BT.601, rango completo). Se trabaja en
# RGB (gbrp) y se sale una sola vez a BT.709 de rango limitado, que es lo que
# esperan IG/TikTok/FB (con yuvj420p algunos reproductores lavan el negro).
ENTRADA = 'scale=in_range=pc:in_color_matrix=bt601,format=gbrp'
SALIDA = 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p'
COLOR = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']


def pieza(nombre, toma, ss, dur, png, formato, flash, entrada):
    W, H = (1080, 1920) if formato == 'v' else (1080, 1080)
    out = os.path.join(PIEZAS, f'{formato}_{nombre}.mp4')
    n = round(dur * FPS)
    base = filtro_toma(toma, formato)
    fl = ',fade=t=in:st=0:d=0.2:color=white' if flash else ''
    if entrada:
        cap = "[1:v]format=rgba,fade=t=in:st=0:d=0.22:alpha=1[r];[v][r]overlay=x=0:y='if(lt(t,0.22),-46*(1-t/0.22),0)':eval=frame:format=gbrp"
    else:
        cap = '[1:v]format=rgba[r];[v][r]overlay=0:0:format=gbrp'
    fc = f'[0:v]{ENTRADA},{base},fps={FPS},setsar=1{fl}[v];{cap},{SALIDA}[o]'
    sh(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{ss:.3f}', '-i', os.path.join(TOMAS, toma + '.mp4'), '-loop', '1', '-i', png,
        '-filter_complex', fc, '-map', '[o]', '-frames:v', str(n), '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', *COLOR, out])
    return out


def pieza_cta(formato, capas_png):
    W, H = (1080, 1920) if formato == 'v' else (1080, 1080)
    out = os.path.join(PIEZAS, f'{formato}_cta.mp4')
    toma, ss = CTA_FONDO
    n = round(CTA_DUR * FPS)
    base = filtro_toma(toma, formato)
    fc = (f'[0:v]{ENTRADA},{base},fps={FPS},setsar=1,boxblur=14:2,colorchannelmixer=rr=0.55:gg=0.55:bb=0.55,fade=t=in:st=0:d=0.25:color=white[v0];'
          f'[1:v]format=rgba,fade=t=in:st=0.0:d=0.3:alpha=1[c1];[2:v]format=rgba,fade=t=in:st=0.35:d=0.3:alpha=1[c2];[3:v]format=rgba,fade=t=in:st=0.7:d=0.3:alpha=1[c3];'
          "[v0][c1]overlay=x=0:y='if(lt(t,0.3),-40*(1-t/0.3),0)':eval=frame:format=gbrp[v1];"
          "[v1][c2]overlay=x=0:y='if(lt(t,0.65),if(lt(t,0.35),40,40*(1-(t-0.35)/0.3)),0)':eval=frame:format=gbrp[v2];"
          "[v2][c3]overlay=x=0:y='if(lt(t,1.0),if(lt(t,0.7),40,40*(1-(t-0.7)/0.3)),0)':eval=frame:format=gbrp," + SALIDA + "[o]")
    args = ['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(ss), '-i', os.path.join(TOMAS, toma + '.mp4')]
    for p in capas_png:
        args += ['-loop', '1', '-i', p]
    sh(args + ['-filter_complex', fc, '-map', '[o]', '-frames:v', str(n), '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', *COLOR, out])
    return out


# ════════════════ AUDIO ════════════════
SR = 44100


def leer_audio(ruta):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', ruta, '-f', 's16le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True)
    return np.frombuffer(r.stdout, dtype='<i2').reshape(-1, 2).astype(np.float32) / 32768


def mezclar_audio(golpes, salida):
    musica = os.path.join(TRAB, 'musica.wav')
    sh([sys.executable, os.path.join(AQUI, 'musica.py'), musica])
    m = leer_audio(musica)
    n = int(DURACION * SR)
    mezcla = np.zeros((n, 2), np.float32)
    mezcla[:min(n, len(m))] += m[:n] * 0.78
    cache = {}
    for t, nombre, vol in golpes:
        if nombre not in cache:
            cache[nombre] = leer_audio(os.path.join(RAIZ, 'audio', 'sfx', nombre + '.ogg'))
        s = cache[nombre]
        i = int(t * SR)
        if i >= n:
            continue
        k = min(len(s), n - i)
        mezcla[i:i + k] += s[:k] * vol * 0.55
    pico = np.max(np.abs(mezcla))
    if pico > 0.98:
        mezcla *= 0.98 / pico
    with wave.open(salida, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mezcla * 32767).astype('<i2').tobytes())


# ════════════════ PORTADA ════════════════
def portada(salida):
    toma, ss = 'mazmorra', 4.2
    tmp = os.path.join(TRAB, 'portada_fondo.png')
    sh(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(ss), '-i', os.path.join(TOMAS, toma + '.mp4'), '-frames:v', '1',
        '-vf', filtro_toma(toma, 'v'), tmp])
    fondo = Image.open(tmp).convert('RGBA')
    # degradado oscuro arriba para el titulo
    grad = Image.new('L', (1, 1920))
    for y in range(1920):
        grad.putpixel((0, y), int(max(0, 240 * min(1, 1.25 * (1 - y / 1100)))) if y < 1100 else int(max(0, 160 * (y - 1500) / 420)) if y > 1500 else 0)
    negro = Image.new('RGBA', (1080, 1920), (6, 4, 16, 255))
    negro.putalpha(grad.resize((1080, 1920)))
    fondo.alpha_composite(negro)
    capa = Image.new('RGBA', (1080, 1920), (0, 0, 0, 0))
    capa.alpha_composite(icono(240), (420, 290))
    y = 560
    t = linea(capa, 'DUENDE QUEST', 540, y, NEGRA, 140, (255, 230, 0), borde=11)
    y += int(t * 1.15)
    t = linea(capa, 'El MMORPG pixel art', 540, y, NEGRA, 76, BLANCO, borde=8)
    y += int(t * 1.25)
    y = pastilla(capa, 'Juega gratis en Telegram y en el navegador', 540, y + 10, 44, (37, 99, 235), BLANCO, NEGRITA, alfa=240) + 20
    pastilla(capa, '4 clases · mazmorras · duelos · eventos', 540, y, 40, (12, 10, 24), BLANCO, NEGRITA, alfa=200)
    fondo.alpha_composite(con_sombra(capa))
    fondo.convert('RGB').save(salida)


# ════════════════ MONTAJE ════════════════
def hojas():
    os.makedirs(os.path.join(TRAB, 'hojas'), exist_ok=True)
    for f in sorted(os.listdir(TOMAS)):
        if not f.endswith('.mp4'):
            continue
        d = duracion(os.path.join(TOMAS, f))
        out = os.path.join(TRAB, 'hojas', f.replace('.mp4', '.png'))
        cols = int(d * 2)
        sh(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(TOMAS, f), '-vf',
            f"fps=2,scale=180:-2,drawtext=fontfile='C\\:/Windows/Fonts/segoeuib.ttf':text='%{{pts\\:hms}}':x=4:y=4:fontsize=18:fontcolor=yellow:box=1:boxcolor=black,tile={cols}x1",
            '-frames:v', '1', out])
        print(f, f'{d:.1f} s ->', out)


def montar(formato):
    os.makedirs(PIEZAS, exist_ok=True)
    os.makedirs(ROT, exist_ok=True)
    piezas, golpes, t = [], [], 0.0
    for ie, esc in enumerate(ESCENAS):
        for t_rel, nombre, vol in esc.get('sfx', []):
            golpes.append((t + t_rel, nombre, vol))
        for ip, (toma, ss, dur, chip) in enumerate(esc['partes']):
            png = os.path.join(ROT, f'{formato}_{esc["id"]}_{ip}.png')
            rotulo(esc, chip, formato, ip == 0).save(png)
            dmax = duracion(os.path.join(TOMAS, toma + '.mp4'))
            ss = min(ss, max(0, dmax - dur - 0.05))
            piezas.append(pieza(f'{ie:02d}_{ip}_{toma}', toma, ss, dur, png, formato, flash=(ip == 0 and ie > 0), entrada=(ip == 0)))
            t += dur
    capas = []
    for i, c in enumerate(tarjeta_final(formato)):
        p = os.path.join(ROT, f'{formato}_cta_{i}.png')
        c.save(p)
        capas.append(p)
    golpes += [(t, 'explosion', 0.6), (t + 0.35, 'boton', 0.7), (t + 0.7, 'moneda', 0.6)]
    piezas.append(pieza_cta(formato, capas))
    t += CTA_DUR
    lista = os.path.join(PIEZAS, f'{formato}_lista.txt')
    with open(lista, 'w', encoding='utf8') as f:
        for p in piezas:
            f.write("file '" + p.replace('\\', '/') + "'\n")
    mudo = os.path.join(TRAB, f'{formato}_mudo.mp4')
    sh(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', mudo])
    return mudo, golpes, t


def exportar(mudo, audio, salida, cuadrado):
    sh(['ffmpeg', '-y', '-loglevel', 'error', '-i', mudo, '-i', audio,
        '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-level:v', '4.1' if cuadrado else '4.2',
        '-pix_fmt', 'yuv420p', *COLOR, '-r', str(FPS), '-maxrate', '14M', '-bufsize', '28M', '-g', str(FPS * 2),
        '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
        '-t', f'{DURACION:.3f}', '-movflags', '+faststart', salida])


def main():
    if '--hojas' in sys.argv:
        return hojas()
    os.makedirs(PROMO, exist_ok=True)
    salidas = {}
    for formato, nombre in (('v', 'duende_quest_promo_30s.mp4'), ('c', 'duende_quest_promo_30s_cuadrado.mp4')):
        mudo, golpes, t = montar(formato)
        print(formato, 'montado:', f'{t:.2f} s')
        audio = os.path.join(TRAB, 'audio_final.wav')
        mezclar_audio(golpes, audio)
        salida = os.path.join(PROMO, nombre)
        exportar(mudo, audio, salida, formato == 'c')
        salidas[nombre] = salida
    portada(os.path.join(PROMO, 'portada.png'))
    for n, s in salidas.items():
        print(n, f'{duracion(s):.2f} s', f'{os.path.getsize(s) / 1e6:.1f} MB')
    print('portada.png listo')


if __name__ == '__main__':
    main()
