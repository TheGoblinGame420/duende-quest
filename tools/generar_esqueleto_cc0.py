# -*- coding: utf-8 -*-
"""
DUENDE QUEST — hoja de animacion del esqueleto a partir del pack CC0
MV Platformer Skeleton (Moikmellah, ver recursos/enemigos/moikmellah-mv-skeleton).

Segundo enemigo con hoja de animacion de verdad (el primero fue el goblin
"normal", ver generar_enemigos_cc0.py). Este va a los biomas NOCHE y
TORMENTA, mezclado con el goblin, para que esos dos biomas no se sientan
como "el mismo enemigo repintado".

La hoja original (320x640, 10 col x 10 filas, celda 32x64) solo tiene
dibujo en las filas 0-5 y las columnas usadas no son las mismas que en el
goblin (confirmado recortando y mirando cada fila con PIL, no a ojo):
  fila 0, col 1-6: ciclo de caminar (col 0 es un idle de frente que no
                   encaja en un ciclo en bucle, y col 7-9 ya son
                   transicion a agachado).
  fila 1, col 0-1: pose de guardia/golpe, sirve de parpadeo al recibir daño.
  fila 5, col 1,2,4: tropiezo -> cayendo -> tirado en el suelo (col 3 esta
                     casi vacia, es una transicion; se descarta).
Se re-empaquetan como 3 filas nuevas (caminar / dano / KO) para no cargar
las otras ~7 filas de ataques que este enemigo no usa (no tiene combate,
solo contacto, igual que el goblin "normal").

Uso:  python tools/generar_esqueleto_cc0.py
"""
import os

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN = os.path.join(RAIZ, 'recursos', 'enemigos', 'moikmellah-mv-skeleton', 'skeletonBase.png')
DESTINO = os.path.join(RAIZ, 'assets', 'enemigos', 'sheets')

CELDA = 32, 64
CAMINAR_COLS = [1, 2, 3, 4, 5, 6]
DANO_COLS = [0, 1]
KO_COLS = [1, 2, 4]


def _fila(im, fila, cols):
    hoja = Image.new('RGBA', (CELDA[0] * len(cols), CELDA[1]), (0, 0, 0, 0))
    for i, c in enumerate(cols):
        celda = im.crop((c * CELDA[0], fila * CELDA[1], c * CELDA[0] + CELDA[0], fila * CELDA[1] + CELDA[1]))
        hoja.paste(celda, (i * CELDA[0], 0))
    return hoja


def main():
    os.makedirs(DESTINO, exist_ok=True)
    im = Image.open(ORIGEN).convert('RGBA')

    # Fila 1 junta daño (2) + KO (3) en la MISMA fila, igual que hace el
    # goblin en su hoja original: sheetFrame() en engine.js lee las dos cosas
    # de "filaGolpe" (daño en colGolpeIni, KO mas adelante en colMuerteIni),
    # asi no hace falta tocar esa funcion para sumar este segundo enemigo.
    ancho = CELDA[0] * max(len(CAMINAR_COLS), len(DANO_COLS) + len(KO_COLS))
    hoja = Image.new('RGBA', (ancho, CELDA[1] * 2), (0, 0, 0, 0))
    hoja.paste(_fila(im, 0, CAMINAR_COLS), (0, 0))
    fila_golpe = Image.new('RGBA', (ancho, CELDA[1]), (0, 0, 0, 0))
    fila_golpe.paste(_fila(im, 1, DANO_COLS), (0, 0))
    fila_golpe.paste(_fila(im, 5, KO_COLS), (CELDA[0] * len(DANO_COLS), 0))
    hoja.paste(fila_golpe, (0, CELDA[1]))

    hoja = hoja.quantize(colors=32, method=Image.Quantize.FASTOCTREE)
    ruta = os.path.join(DESTINO, 'esqueleto.png')
    hoja.save(ruta, optimize=True)
    print(f'esqueleto.png {hoja.size} -> {os.path.getsize(ruta)} bytes')


if __name__ == '__main__':
    main()
