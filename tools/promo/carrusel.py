# Carrusel de 3 imagenes 1080x1350 (Instagram/Facebook) con capturas reales.
#   python tools/promo/carrusel.py   -> promo/carrusel_1.png .. carrusel_3.png
# Usa las capturas de assets/capturas/ y las fuentes de Windows (Segoe UI).
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SALIDA = os.path.join(RAIZ, 'promo')
F = 'C:/Windows/Fonts/'
NEGRA = F + 'seguibl.ttf'
NEGRITA = F + 'segoeuib.ttf'
EMOJI = F + 'seguiemj.ttf'
FONDO = (11, 15, 23)
ORO = (242, 193, 78)
BLANCO = (230, 233, 240)
GRIS = (154, 163, 181)
AZUL = (37, 99, 235)
W, H = 1080, 1350

def texto_centrado(d, y, txt, fuente, color, sombra=True):
    w = d.textlength(txt, font=fuente)
    x = (W - w) / 2
    if sombra:
        d.text((x + 3, y + 3), txt, font=fuente, fill=(0, 0, 0))
    d.text((x, y), txt, font=fuente, fill=color)

def lamina(n, titulo1, titulo2, sub, captura, emoji=None, nota=None):
    im = Image.new('RGB', (W, H), FONDO)
    cap = Image.open(os.path.join(RAIZ, 'assets', 'capturas', captura)).convert('RGB')
    # Fondo: la misma captura muy desenfocada y oscura
    fondo = cap.resize((int(cap.width * H / cap.height), H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(28))
    fondo = Image.eval(fondo, lambda v: int(v * 0.28))
    im.paste(fondo, ((W - fondo.width) // 2, 0))
    d = ImageDraw.Draw(im)
    # Titulos
    texto_centrado(d, 70, titulo1, ImageFont.truetype(NEGRA, 88), BLANCO)
    texto_centrado(d, 170, titulo2, ImageFont.truetype(NEGRA, 88), ORO)
    texto_centrado(d, 285, sub, ImageFont.truetype(NEGRITA, 40), BLANCO)
    # Captura con borde (pixel art nitido: escalado vecino si se agranda)
    ancho = 1000
    alto = int(cap.height * ancho / cap.width)
    met = Image.NEAREST if ancho > cap.width * 1.2 else Image.LANCZOS
    c2 = cap.resize((ancho, alto), met)
    y0 = 380 + max(0, (620 - alto) // 2)
    marco = Image.new('RGB', (ancho + 8, alto + 8), (38, 48, 73))
    im.paste(marco, ((W - ancho) // 2 - 4, y0 - 4))
    im.paste(c2, ((W - ancho) // 2, y0))
    if emoji:
        fe = ImageFont.truetype(EMOJI, 109)
        d.text((W - 200, y0 + alto - 150), emoji, font=fe, embedded_color=True)
    # Pie: logo + llamada a la accion
    logo = Image.open(os.path.join(RAIZ, 'assets', 'ui', 'coin.png')).convert('RGBA').resize((110, 110), Image.NEAREST)
    im.paste(logo, ((W - 110) // 2, 1040), logo)
    texto_centrado(d, 1160, 'Juega gratis · Sin descargas', ImageFont.truetype(NEGRITA, 46), BLANCO)
    boton = '@duendequest_bot en Telegram'
    fb = ImageFont.truetype(NEGRITA, 40)
    bw = d.textlength(boton, font=fb) + 60
    d.rounded_rectangle(((W - bw) / 2, 1228, (W + bw) / 2, 1292), radius=32, fill=AZUL)
    texto_centrado(d, 1236, boton, fb, (255, 255, 255), sombra=False)
    if nota:
        texto_centrado(d, 1305, nota, ImageFont.truetype(NEGRITA, 22), GRIS, sombra=False)
    ruta = os.path.join(SALIDA, f'carrusel_{n}.png')
    im.save(ruta, optimize=True)
    print(ruta)

os.makedirs(SALIDA, exist_ok=True)
lamina(1, 'UN MMORPG', 'DE DUENDES', 'Gratis en tu celular y en el navegador', 'mmo-dragon-acantilados.png')
lamina(2, 'MAZMORRAS', 'CON JEFES', 'Solo o en grupo · 4 clases · duelos', 'mmo-jefe-selva.png')
lamina(3, 'GANA CHICHA', 'MORADA JUGANDO', '10.000 puntos = 1 litro a tu casa', 'mmo-cavernas-combate.png', emoji='🥤',
       nota='Promoción: puntos con cuenta de Telegram desde Nv 10. Condiciones en el juego.')
