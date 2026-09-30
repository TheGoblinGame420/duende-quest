# -*- coding: utf-8 -*-
"""
DUENDE QUEST — hoja de animacion de la rana "sunny-froggy" (Sideview Fantasy
Patreon Collection, ansimuz, CC0 — ver
recursos/enemigos/ansimuz-sideview-fantasy/sunny-froggy, mismo pack que ya
dio lagarto y serpiente) para el bioma SELVA ESMERALDA, sumandose a
goblin_normal/hongo/goblin_centurion/goblin_battlelord.

recursos/INDICE.md ya sugeria "seta y rana -> selva/amanecer"; se eligio
SELVA (no amanecer) porque una rana de charca es fauna de selva/pantano tan
directa como la seta que ya esta ahi, mientras que AMANECER se resolvio esta
misma tanda con guard/knight/pajaro (ver generar_goblin_variantes4_cc0.py y
generar_pajaro_cc0.py).

Cuarto enemigo no-humanoide (despues de hongo/lagarto/serpiente). A
diferencia de esos tres (una sola rejilla por tira), este pack trae TRES
tiras sueltas con celdas de tamaño DISTINTO cada una (medido con PIL, bbox
del canal alpha, NO solo FRAMES.txt):
  sunny-froggy-walk.png     (420x38): 10 frames de 42x38 (bbox alto hasta 33px)
  sunny-froggy-taunting.png (212x42): 4 frames de 53x42 (bbox alto hasta 34px,
                              rana irguiendose y croando con la boca bien
                              abierta y los brazos arriba — frames 0/1/3 son
                              casi identicos, frame 2 es la unica pose
                              distinta: torcida/inclinada, brazo bajando)
  sunny-froggy-jump.png   (1344x80): 7 frames de 192x80 (salto horizontal que
                              recorre TODA la celda ancha — sirve para ver el
                              arco del salto, pero ninguna pose aislada es
                              utilizable como flash/colapso sin verse
                              "cortada a la mitad del salto"; no se usa)

Sin frames de daño ni muerte propios (mismo problema que lagarto/serpiente/
ghoul/hechicero). Se resuelve reusando "taunting": frame 0 (croar con la
boca abierta, brazos arriba) + frame 2 (la pose torcida) como flash de golpe
de 2 cuadros, y frame 2 otra vez como pose de colapso (se lee como que la
rana se dobla hacia un lado), con el fade-out por alpha de siempre.

Caminar (42x38) y taunting (53x42) tienen celdas de tamaño DISTINTO en ambos
ejes (no solo ancho, como en el caso de la serpiente): se usa la celda mas
grande (53x42, la de taunting) como celda final y caminar se pega centrado
horizontalmente Y anclado abajo (mismo borde inferior = mismo punto de apoyo
de las patas en las dos tiras), para que el personaje no salte de tamaño de
golpe al pasar de mov a golpe.

idealAltoPx = maximo bbox de alto entre TODOS los frames usados (caminar +
taunting), igual metodo que el resto de packers.

Uso:  python tools/generar_rana_cc0.py
"""
import os

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN = os.path.join(RAIZ, 'recursos', 'enemigos', 'ansimuz-sideview-fantasy', 'sunny-froggy', 'PNG')
DESTINO = os.path.join(RAIZ, 'assets', 'enemigos', 'sheets')

CELDA_MOV = 42, 38
CELDA_TAUNT = 53, 42
N_MOV = 10
GOLPE_IDX = [0, 2]   # croar (boca abierta, brazos arriba) + pose torcida
MUERTE_IDX = [2]     # la pose torcida, reusada como colapso
N_COLS = max(N_MOV, len(GOLPE_IDX) + len(MUERTE_IDX))

FW = max(CELDA_MOV[0], CELDA_TAUNT[0])  # 53
FH = max(CELDA_MOV[1], CELDA_TAUNT[1])  # 42
OFFSET_MOV_X = (FW - CELDA_MOV[0]) // 2
OFFSET_MOV_Y = FH - CELDA_MOV[1]  # ancla abajo (borde inferior comun)


def _bbox_alto(im, ncols, cw, ch):
    miny, maxy = ch, 0
    for c in range(ncols):
        celda = im.crop((c * cw, 0, c * cw + cw, ch))
        bbox = celda.split()[-1].getbbox()
        if bbox:
            miny = min(miny, bbox[1])
            maxy = max(maxy, bbox[3])
    return maxy - miny


def main():
    os.makedirs(DESTINO, exist_ok=True)
    caminar = Image.open(os.path.join(ORIGEN, 'sunny-froggy-walk.png')).convert('RGBA')
    taunt = Image.open(os.path.join(ORIGEN, 'sunny-froggy-taunting.png')).convert('RGBA')
    assert caminar.size == (CELDA_MOV[0] * N_MOV, CELDA_MOV[1]), caminar.size
    assert taunt.size == (CELDA_TAUNT[0] * 4, CELDA_TAUNT[1]), taunt.size

    alto = max(
        _bbox_alto(caminar, N_MOV, CELDA_MOV[0], CELDA_MOV[1]),
        _bbox_alto(taunt, 4, CELDA_TAUNT[0], CELDA_TAUNT[1]),
    )

    ancho = FW * N_COLS
    hoja = Image.new('RGBA', (ancho, FH * 2), (0, 0, 0, 0))

    fila_mov = Image.new('RGBA', (ancho, FH), (0, 0, 0, 0))
    for c in range(N_MOV):
        frame = caminar.crop((c * CELDA_MOV[0], 0, c * CELDA_MOV[0] + CELDA_MOV[0], CELDA_MOV[1]))
        fila_mov.paste(frame, (c * FW + OFFSET_MOV_X, OFFSET_MOV_Y))
    hoja.paste(fila_mov, (0, 0))

    fila_golpe = Image.new('RGBA', (ancho, FH), (0, 0, 0, 0))
    for i, idx in enumerate(GOLPE_IDX):
        frame = taunt.crop((idx * CELDA_TAUNT[0], 0, idx * CELDA_TAUNT[0] + CELDA_TAUNT[0], CELDA_TAUNT[1]))
        fila_golpe.paste(frame, (i * FW, 0))
    for i, idx in enumerate(MUERTE_IDX):
        frame = taunt.crop((idx * CELDA_TAUNT[0], 0, idx * CELDA_TAUNT[0] + CELDA_TAUNT[0], CELDA_TAUNT[1]))
        fila_golpe.paste(frame, ((len(GOLPE_IDX) + i) * FW, 0))
    hoja.paste(fila_golpe, (0, FH))

    hoja = hoja.quantize(colors=48, method=Image.Quantize.FASTOCTREE)
    ruta = os.path.join(DESTINO, 'rana.png')
    hoja.save(ruta, optimize=True)
    print(f'rana.png {hoja.size} idealAltoPx={alto} fw={FW} fh={FH} -> {os.path.getsize(ruta)} bytes')


if __name__ == '__main__':
    main()
