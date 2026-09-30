# -*- coding: utf-8 -*-
"""
DUENDE QUEST — hoja de animacion del "enemy-ghost" (Sideview Fantasy Patreon
Collection, ansimuz, CC0 — ver
recursos/enemigos/ansimuz-sideview-fantasy/enemy-ghost, mismo pack que ya dio
lagarto/serpiente/rana) para el bioma NOCHE VIOLETA, sumandose a
goblin_normal/esqueleto/goblin_assassin/hechicero.

recursos/INDICE.md ya sugeria "fantasma -> noche" y aqui se confirmo a ojo:
craneo gris flotando dentro de una capa negra con contorno y particulas
ROSA/MAGENTA brillante — encaja directo con "cementerio nocturno" junto al
esqueleto y el nigromante (hechicero), y el magenta funciona bien como
segundo acento de color ademas del verde de linea de NOCHE VIOLETA
('#00ff88' en BIOMES) sin desentonar (la paleta de NOCHE ya es
morada/violeta de fondo).

Quinto enemigo no-humanoide (despues de hongo/lagarto/serpiente/rana). El
pack trae DOS variantes en PNG/: transparent-particles.png (con las motas
rosa alrededor) y transparent-no-particles.png (sin ellas, mismos 6 frames
de flotar). Se uso la version CON particulas: son solo unos pixeles sueltos
extra por frame, no cambian el tamaño de celda ni el bbox de forma
relevante, y le dan mas caracter "espectral" al sprite mas chico del lote.

Medido con PIL (bbox del canal alpha por celda, no solo el nombre del
archivo): 384x64, 6 frames de 64x64. Es un ciclo de flotar continuo, sin
tags de animacion separados (a diferencia del burning-ghoul, que si excluia
un frame suelto de su tag) — incluye piernas/cola ondulando y el contorno
respirando entre 31 y 36 px de alto segun el frame.

Sin frames de daño ni muerte propios (mismo problema que el resto del
bestiario "salvaje"): se usan los 6 frames como movimiento (nMov=6) y se
reusan los DOS frames de bbox mas alto/expandido (4 y 5, la capa mas abierta)
como flash de golpe, y el frame 5 otra vez como pose de colapso — mismo
patron de reuso de cola de ciclo que tools/generar_ghoul_ardiente_cc0.py.

idealAltoPx = maximo bbox de alto entre TODOS los frames (0-5, incluye los
reusados en golpe/muerte).

Uso:  python tools/generar_fantasma_cc0.py
"""
import os

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN = os.path.join(RAIZ, 'recursos', 'enemigos', 'ansimuz-sideview-fantasy', 'enemy-ghost', 'PNG')
DESTINO = os.path.join(RAIZ, 'assets', 'enemigos', 'sheets')

CELDA = 64, 64
N_TOTAL = 6       # unico ciclo de flotar, sin tags separados
N_MOV = 6
GOLPE_IDX = [4, 5]   # los dos frames de capa mas abierta/expandida
MUERTE_IDX = [5]     # el mismo ultimo frame, reusado como colapso
N_COLS = max(N_MOV, len(GOLPE_IDX) + len(MUERTE_IDX))


def _bbox_alto(frames):
    miny, maxy = CELDA[1], 0
    for im in frames:
        bbox = im.split()[-1].getbbox()
        if bbox:
            miny = min(miny, bbox[1])
            maxy = max(maxy, bbox[3])
    return maxy - miny


def main():
    os.makedirs(DESTINO, exist_ok=True)
    tira = Image.open(os.path.join(ORIGEN, 'transparent-particles.png')).convert('RGBA')
    assert tira.size == (CELDA[0] * N_TOTAL, CELDA[1]), tira.size
    frames = [tira.crop((i * CELDA[0], 0, i * CELDA[0] + CELDA[0], CELDA[1])) for i in range(N_TOTAL)]

    alto = _bbox_alto(frames)

    ancho = CELDA[0] * N_COLS
    hoja = Image.new('RGBA', (ancho, CELDA[1] * 2), (0, 0, 0, 0))
    for i in range(N_MOV):
        hoja.paste(frames[i], (i * CELDA[0], 0))
    for i, idx in enumerate(GOLPE_IDX):
        hoja.paste(frames[idx], (i * CELDA[0], CELDA[1]))
    for i, idx in enumerate(MUERTE_IDX):
        hoja.paste(frames[idx], ((len(GOLPE_IDX) + i) * CELDA[0], CELDA[1]))

    hoja = hoja.quantize(colors=32, method=Image.Quantize.FASTOCTREE)
    ruta = os.path.join(DESTINO, 'fantasma.png')
    hoja.save(ruta, optimize=True)
    print(f'fantasma.png {hoja.size} idealAltoPx={alto} -> {os.path.getsize(ruta)} bytes')


if __name__ == '__main__':
    main()
