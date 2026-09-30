# Genera assets/mmo_banner.png (1200x630, vista previa al compartir /mmo/)
# con los MISMOS sprites y fondos CC0 que usa el juego: nada de arte nuevo.
# Uso: py tools/generar_banner_mmo.py
import json, math, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = lambda *p: os.path.join(RAIZ, 'assets', *p)
W, H, SUELO = 1200, 630, 560

img = Image.new('RGBA', (W, H))
d = ImageDraw.Draw(img)
for y in range(H):  # cielo nocturno
    k = y / H
    d.line([(0, y), (W, y)], fill=(int(2 + 20 * k), int(0 + 8 * k), int(21 + 30 * k), 255))

def capa(nombre, sobre_suelo, escala):
    c = Image.open(A('fondos', nombre)).convert('RGBA')
    c = c.resize((int(c.width * escala), int(c.height * escala)), Image.NEAREST)
    y = SUELO - c.height + int(sobre_suelo * escala)
    x = -40
    while x < W:
        img.alpha_composite(c, (x, y)); x += c.width

capa('noche_lejos.png', 46, 2.0)
capa('noche_cerca.png', 16, 2.0)
d = ImageDraw.Draw(img)
d.rectangle([0, SUELO, W, H], fill=(10, 26, 15, 255))
d.rectangle([0, SUELO, W, SUELO + 4], fill=(0, 255, 136, 255))

def hoja(nombre, fw, fh, col, fila, alto, x, pies, espejo=False, alpha=255):
    s = Image.open(A('enemigos', 'sheets', nombre + '.png')).convert('RGBA')
    cel = s.crop((col * fw, fila * fh, (col + 1) * fw, (fila + 1) * fh))
    bb = cel.getbbox()
    if bb: cel = cel.crop(bb)
    e = alto / cel.height
    cel = cel.resize((max(1, int(cel.width * e)), int(alto)), Image.NEAREST)
    if espejo: cel = cel.transpose(Image.FLIP_LEFT_RIGHT)
    if alpha < 255:
        a = cel.getchannel('A').point(lambda v: v * alpha // 255); cel.putalpha(a)
    img.alpha_composite(cel, (int(x - cel.width / 2), int(pies - cel.height)))

def estatica(ruta, alto, x, pies, espejo=False):
    s = Image.open(ruta).convert('RGBA')
    bb = s.getbbox(); s = s.crop(bb) if bb else s
    e = alto / s.height
    s = s.resize((int(s.width * e), int(alto)), Image.NEAREST)
    if espejo: s = s.transpose(Image.FLIP_LEFT_RIGHT)
    img.alpha_composite(s, (int(x - s.width / 2), int(pies - s.height)))

def brillo(x, y, r, color):
    g = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse([x - r, y - r, x + r, y + r], fill=color)
    img.alpha_composite(g.filter(ImageFilter.GaussianBlur(r * .45)))

# Portal (mismo dibujo que el juego: elipses de neon)
brillo(150, SUELO - 90, 90, (192, 132, 252, 110))
dp = ImageDraw.Draw(img)
for i, (c, rx, ry) in enumerate([((192, 132, 252), 46, 88), ((0, 238, 255), 36, 72), ((255, 60, 240), 26, 56)]):
    dp.ellipse([150 - rx, SUELO - 90 - ry, 150 + rx, SUELO - 90 + ry], outline=c + (255,), width=5)

# Jefe y monstruos
brillo(950, SUELO - 60, 160, (255, 60, 240, 150))
hoja('hellhound', 67, 39, 1, 0, 140, 950, SUELO, espejo=True)
hoja('esqueleto', 32, 64, 2, 0, 118, 745, SUELO, espejo=True)
hoja('goblin_assassin', 32, 64, 3, 0, 112, 1110, SUELO, espejo=True)
hoja('fantasma', 64, 64, 1, 0, 90, 1060, SUELO - 230, espejo=True, alpha=235)
hoja('hechicero', 81, 66, 0, 0, 120, 620, SUELO - 150 + 150, espejo=True)

# Duendes (el animado y dos skins) a la izquierda
estatica(A('skins', 'skin_legendariafull.png'), 150, 300, SUELO)
meta = json.load(open(A('skins', 'duende_anim.json')))
cw, ch = meta['celda']
atlas = Image.open(A('skins', 'duende_anim.png')).convert('RGBA')
fr = atlas.crop((11 * cw, 0, 12 * cw, ch))
bb = fr.getbbox(); fr = fr.crop(bb)
e = 150 / fr.height
fr = fr.resize((int(fr.width * e), 150), Image.NEAREST)
img.alpha_composite(fr, (int(455 - fr.width / 2), SUELO - 150))
estatica(A('skins', 'skin_berserker.png'), 138, 150, SUELO - 2)

# Texto
def fuente(nombres, tam):
    for n in nombres:
        p = os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts', n)
        if os.path.exists(p): return ImageFont.truetype(p, tam)
    return ImageFont.load_default()
f1 = fuente(['impact.ttf', 'arialbd.ttf'], 104)
f2 = fuente(['impact.ttf', 'arialbd.ttf'], 60)
f3 = fuente(['arialbd.ttf', 'segoeuib.ttf'], 30)
dt = ImageDraw.Draw(img)
def texto(xy, t, f, color, borde=6, ancla='mm'):
    dt.text(xy, t, font=f, fill=color, anchor=ancla, stroke_width=borde, stroke_fill=(10, 4, 24, 255))
texto((W / 2, 92), 'DUENDE QUEST', f1, (255, 230, 0, 255), 8)
texto((W / 2, 178), 'ONLINE', f2, (0, 238, 255, 255), 6)
texto((W / 2, 236), 'EL MMORPG DE LOS DUENDES  ·  JUEGA GRATIS', f3, (255, 255, 255, 255), 4)
texto((W / 2, 598), 'Web y Telegram  ·  5 zonas  ·  jefes  ·  misiones  ·  7 skins', f3, (0, 255, 136, 255), 4)

img.convert('RGB').save(A('mmo_banner.png'), optimize=True)
print('ok', os.path.getsize(A('mmo_banner.png')), 'bytes')
