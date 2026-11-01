# Genera assets/og/arcade.jpg (1200x630) para la vista previa de /game al compartir.
# Usa la captura assets/capturas/arcade-combate.png sin la barra inferior (que muestra $DUENDE).
from PIL import Image, ImageDraw, ImageFont
W, H = 1200, 630
src = Image.open('assets/capturas/arcade-combate.png').convert('RGB').crop((0, 60, 1136, 452))
src = src.resize((W, int(src.height * W / src.width)), Image.LANCZOS)
c = Image.new('RGB', (W, H), (10, 6, 22))
c.paste(src, (0, H - src.height))
d = ImageDraw.Draw(c)
# Fundido del borde superior de la captura al fondo
for i in range(60):
    y = H - src.height + i
    d.line([(0, y), (W, y)], fill=(10, 6, 22), width=1) if i == 0 else None
ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
top = H - src.height
for i in range(80):
    od.line([(0, top + i), (W, top + i)], fill=(10, 6, 22, int(255 * (1 - i / 80))))
c = Image.alpha_composite(c.convert('RGBA'), ov)
d = ImageDraw.Draw(c)
F = 'C:/Windows/Fonts/'
ft = ImageFont.truetype(F + 'impact.ttf', 92)
fs = ImageFont.truetype(F + 'seguibl.ttf', 34)
def centro(y, t, f, fill, sw):
    w = d.textlength(t, font=f)
    d.text(((W - w) / 2, y), t, font=f, fill=fill, stroke_width=sw, stroke_fill=(0, 0, 0))
centro(26, 'DUENDE QUEST ARCADE', ft, (255, 216, 74), 6)
centro(138, 'Plataformas en pixel art · gratis y sin descargas', fs, (255, 255, 255), 3)
c.convert('RGB').save('assets/og/arcade.jpg', 'JPEG', quality=85, optimize=True, progressive=True)
