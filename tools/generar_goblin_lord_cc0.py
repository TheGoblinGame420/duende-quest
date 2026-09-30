# -*- coding: utf-8 -*-
"""
DUENDE QUEST — hoja de animacion del goblin LORD (rey goblin), la ultima
variante sin usar del pack CC0 Goblin Corps (Moikmellah, ver
recursos/enemigos/moikmellah-goblin-corps). generar_goblin_variantes4_cc0.py
la dejo aparte a proposito: la corona lo lee como realeza y ningun bioma del
arcade tenia un castillo. Ahora si lo hay: el Castillo del Rey Goblin, la
zona de final de juego de DUENDE QUEST ONLINE (mmo/, Nv 32-40), donde es el
jefe.

Mismo recorte que las 9 variantes previas (misma rejilla 32x64, fila 0 =
idle + caminar, fila 1 = daño + KO) e idealAltoPx medido por bbox alpha.

Uso:  py tools/generar_goblin_lord_cc0.py
"""
import os
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN = os.path.join(RAIZ, 'recursos', 'enemigos', 'moikmellah-goblin-corps', 'full', 'goblin.lord.png')
DESTINO = os.path.join(RAIZ, 'assets', 'enemigos', 'sheets', 'goblin_lord.png')
CELDA = 32, 64


def bbox_alto(im, fila, cols):
    miny, maxy = CELDA[1], 0
    for c in cols:
        celda = im.crop((c * CELDA[0], fila * CELDA[1], (c + 1) * CELDA[0], (fila + 1) * CELDA[1]))
        bb = celda.split()[-1].getbbox()
        if bb:
            miny, maxy = min(miny, bb[1]), max(maxy, bb[3])
    return maxy - miny


im = Image.open(ORIGEN).convert('RGBA')
alto = max(bbox_alto(im, 0, range(1, 7)), bbox_alto(im, 1, range(1, 3)))
recorte = im.crop((0, 0, CELDA[0] * 10, CELDA[1] * 2)).quantize(colors=48, method=Image.Quantize.FASTOCTREE)
recorte.save(DESTINO, optimize=True)
# Vista ampliada para revisarla a ojo antes de integrarla
recorte.convert('RGBA').resize((recorte.width * 4, recorte.height * 4), Image.NEAREST).save(
    os.path.join(RAIZ, 'dist-test', 'goblin_lord_check.png'))
print('goblin_lord.png', recorte.size, 'idealAltoPx=', alto, os.path.getsize(DESTINO), 'bytes')
