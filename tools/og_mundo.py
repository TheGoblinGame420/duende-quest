import sys
from PIL import Image, ImageFilter, ImageDraw, ImageFont, ImageEnhance
S, OUT = sys.argv[1], sys.argv[2]
W, H = 1200, 630
f7 = Image.open(S+'/f7.png').convert('RGB')
f10 = Image.open(S+'/f10.5.png').convert('RGB')
# Fondo: paisaje de vuelo sin texto, ampliado y desenfocado
bg = f7.crop((0, 380, 540, 960))
k = W / 540
bg = bg.resize((W, int(580*k)), Image.LANCZOS)
top = (bg.height - H)//2
bg = bg.crop((0, top, W, top+H)).filter(ImageFilter.GaussianBlur(7))
bg = ImageEnhance.Brightness(bg).enhance(0.75)
# Degradado oscuro a la izquierda para el texto
grad = Image.new('L', (W, H))
gd = ImageDraw.Draw(grad)
for x in range(W):
    a = int(225 * max(0, 1 - x/760)) if x < 760 else 0
    gd.line([(x,0),(x,H)], fill=a)
dark = Image.new('RGB', (W, H), (10, 18, 24))
bg = Image.composite(dark, bg, grad)
def panel(img, box, size, rot):
    p = img.crop(box).resize(size, Image.LANCZOS)
    m = Image.new('L', size, 0); ImageDraw.Draw(m).rounded_rectangle((0,0,size[0]-1,size[1]-1), 22, fill=255)
    fr = Image.new('RGBA', (size[0]+12, size[1]+12), (0,0,0,0))
    ImageDraw.Draw(fr).rounded_rectangle((0,0,fr.width-1,fr.height-1), 28, fill=(255,216,74,255))
    pr = Image.new('RGBA', size); pr.paste(p, (0,0)); pr.putalpha(m)
    fr.alpha_composite(pr, (6,6))
    return fr.rotate(rot, Image.BICUBIC, expand=True)
canvas = bg.convert('RGBA')
p1 = panel(f7, (60, 380, 420, 860), (270, 360), 4)
p2 = panel(f10, (0, 330, 500, 720), (300, 234), -5)
canvas.alpha_composite(p1, (880, 30))
canvas.alpha_composite(p2, (690, 330))
d = ImageDraw.Draw(canvas)
F = 'C:/Windows/Fonts/'
def font(n, s):
    try: return ImageFont.truetype(F+n, s)
    except Exception: return ImageFont.truetype(F+'arialbd.ttf', s)
def txt(xy, t, f, fill, sw=5):
    d.text(xy, t, font=f, fill=fill, stroke_width=sw, stroke_fill=(0,0,0))
txt((58, 58), 'DUENDE QUEST', font('impact.ttf', 104), (255,216,74), 6)
txt((60, 178), '3D', font('impact.ttf', 120), (255,255,255), 6)
fs = font('seguibl.ttf', 40)
txt((60, 330), 'Mundo abierto gratis', fs, (255,255,255), 3)
txt((60, 380), 'desde tu celular', fs, (255,255,255), 3)
# Chip inferior
fc = font('segoeuib.ttf', 28)
chip = 'Vuela · Caza jefes · Juega con amigos'
w = d.textlength(chip, font=fc)
d.rounded_rectangle((56, 470, 56+w+40, 524), 27, fill=(34,197,94))
d.text((76, 477), chip, font=fc, fill=(8,30,14))
fn = font('segoeuib.ttf', 24)
txt((60, 556), 'Sin descargas · En el navegador y en Telegram', fn, (220,235,225), 2)
canvas.convert('RGB').save(OUT, 'JPEG', quality=84, optimize=True, progressive=True)
