# -*- coding: utf-8 -*-
"""
DUENDE QUEST — capas de parallax a partir de los packs CC0 de ansimuz.

Sustituye a las que generaba tools/generar_parallax.py (siluetas planas
dibujadas por codigo) por pixel art de verdad:

  noche     GothicVania Cemetery (luna, montañas, cementerio)
  selva     GothicVania Swamp (pantano)
  desierto  GothicVania Rocky Pass (cañon)
  amanecer  Rocky Pass recoloreado a amanecer rojo
  tormenta  Rocky Pass + pantano con el tono girado a violeta arcano

Todo CC0 (ver CREDITOS.md y recursos/INDICE.md). Los originales viven en
recursos/, que no se publica.

Dos detalles que obliga el motor (dibujarCapa en js/engine.js):
  * cada capa se repite segun su PROPIO ancho, asi que se respeta el ancho del
    tile de origen (o un multiplo) para que el bucle no tenga costura;
  * se ancla al suelo, y en moviles en vertical el canvas mide 400 de alto: la
    capa lejana (opaca, con cielo) se hace de 380 px rellenando hacia arriba
    con el color de su primera fila, para que nunca se vea el corte.

Las capas se oscurecen: el fondo tiene que quedarse detras, y los sprites y
los avisos rojos del jefe tienen que leerse encima.

Uso:  python tools/generar_fondos_cc0.py
"""
import math
import os

from PIL import Image, ImageEnhance

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R = os.path.join(RAIZ, 'recursos', 'mapas')
SALIDA = os.path.join(RAIZ, 'assets', 'fondos')
ALTO_LEJOS = 380    # la lejana cubre tambien el cielo en pantallas verticales

CEM = os.path.join(R, 'ansimuz-gothicvania-cemetery', 'mapa-demo', 'environment')
PAN = os.path.join(R, 'ansimuz-gothicvania-swamp', 'Evironment')
ROC = os.path.join(R, 'ansimuz-rocky-pass', 'PNG')

# bioma: (capas lejos, capas cerca, brillo lejos, brillo cerca, tinte o None)
BIOMAS = {
    'noche':    ([f'{CEM}/bg-moon.png', f'{CEM}/bg-mountains.png'], [f'{CEM}/bg-graveyard.png'], .62, .55, None),
    'selva':    ([f'{PAN}/background.png', f'{PAN}/mid-layer-01.png'], [f'{PAN}/mid-layer-02.png'], .55, .50, None),
    'desierto': ([f'{ROC}/back.png', f'{ROC}/middle.png'], [f'{ROC}/near.png'], .52, .50, None),
    'amanecer': ([f'{ROC}/back.png', f'{ROC}/middle.png'], [f'{ROC}/near.png'], .72, .52, (255, 70, 40)),
    # Tono girado (no teñido): conserva el contraste del pixel art.
    'tormenta': ([f'{ROC}/back.png', f'{ROC}/middle.png'], [f'{PAN}/mid-layer-02.png'], .62, .55, 'tono:265'),
}


def componer(capas):
    """Apila capas del mismo pack a tamaño nativo (sin reescalar: el motor ya
    escala el canvas y un segundo reescalado deformaria los pixeles).
    El ancho final es el minimo comun multiplo de los anchos, asi cada capa
    cabe un numero exacto de veces y el bucle no tiene costura."""
    ims = [Image.open(p).convert('RGBA') for p in capas]
    ancho = 1
    for im in ims:
        ancho = ancho * im.width // math.gcd(ancho, im.width)
    alto = max(i.height for i in ims)
    out = Image.new('RGBA', (ancho, alto), (0, 0, 0, 0))
    for im in ims:
        for x in range(0, ancho, im.width):
            out.alpha_composite(im, (x, alto - im.height))
    return out


def teñir(im, color):
    """Pasa a luminancia y la colorea con el tinte, conservando el alfa."""
    a = im.getchannel('A')
    gris = im.convert('L')
    col = Image.merge('RGB', [gris.point(lambda v, c=c: v * c // 255) for c in color])
    col.putalpha(a)
    return col


def girar_tono(im, grados):
    """Lleva todos los tonos hacia 'grados' (HSV) sin tocar saturacion ni valor."""
    a = im.getchannel('A')
    h, sat, v = im.convert('RGB').convert('HSV').split()
    h = h.point(lambda _: int(grados / 360 * 255))
    out = Image.merge('HSV', (h, sat, v)).convert('RGB')
    out.putalpha(a)
    return out


def procesar(im, brillo, tinte):
    if isinstance(tinte, str) and tinte.startswith('tono:'):
        im = girar_tono(im, int(tinte[5:]))
    elif tinte:
        im = teñir(im, tinte)
    rgb = ImageEnhance.Brightness(im.convert('RGB')).enhance(brillo)
    rgb.putalpha(im.getchannel('A'))
    return rgb


def main():
    for nombre, (lejos, cerca, bl, bc, tinte) in BIOMAS.items():
        l = procesar(componer(lejos), bl, tinte)
        # Rellenar hacia arriba con la primera fila: cielo continuo.
        alto = Image.new('RGBA', (l.width, ALTO_LEJOS), (0, 0, 0, 0))
        # Color dominante de la primera fila (estirar la fila entera convertia
        # cualquier pixel suelto en una raya vertical en el cielo).
        colores = l.crop((0, 0, l.width, 1)).getcolors(l.width)
        cielo = max(colores)[1]
        alto.paste(Image.new('RGBA', (l.width, ALTO_LEJOS - l.height), cielo), (0, 0))
        alto.paste(l, (0, ALTO_LEJOS - l.height))
        c = procesar(componer(cerca), bc, tinte)
        for sufijo, im in (('lejos', alto), ('cerca', c)):
            ruta = os.path.join(SALIDA, f'{nombre}_{sufijo}.png')
            im.quantize(colors=128, method=Image.Quantize.FASTOCTREE).save(ruta, optimize=True)
            print(f'{nombre}_{sufijo:5s} {im.size} {os.path.getsize(ruta) // 1024} KB')


if __name__ == '__main__':
    main()
