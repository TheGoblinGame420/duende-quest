# -*- coding: utf-8 -*-
"""
DUENDE QUEST — hoja de animacion del hongo (Big Mushroom, CC0 — ver
recursos/enemigos/scratchio-big-mushroom) para el bioma SELVA ESMERALDA.

Primer enemigo animado que NO viene del pack Goblin Corps: es un silueta
genuinamente distinta (hongo con sombrero rojo, sin piernas ni brazos
visibles) en vez de otro reskin de humanoide, tal como pide la tanda que lo
agrega. Tambien es el primero con una rejilla mas chica (29x28, contra la
32x64 de goblin/esqueleto), y el primero cuyo origen NO es una sola hoja:
el pack de Scratchio trae cada animacion en un archivo PNG en tira separado
(Walk, Hurt, Die, Spawn, De Spawn, Single), sin fila/columna compartida.

Este script las re-empaqueta en UNA hoja de 2 filas, con el mismo formato
que ya lee sheetFrame()/drawSheet() en js/engine.js (fila 0 = caminar, fila
1 = daño seguido de KO en la MISMA fila):
  fila 0, col 0-5: Big Mushroom_Walk.png completo (6 frames de verdad).
  fila 1, col 0:   Big Mushroom_Hurt.png (el pack solo trae 1 frame de
                   daño, no 2 como el goblin; nGolpe=1 en el SHEETS de
                   engine.js, sheetFrame() ya soporta nGolpe=1).
  fila 1, col 1-6: Big Mushroom_Die.png completo (6 frames: se inclina, el
                   sombrero se voltea y queda tirado — se ve bien en el
                   preview, confirmado con el Read tool antes de commitear).
Se descartan Spawn/De Spawn (el motor ya anima la aparicion/desaparicion de
CUALQUIER enemigo por codigo en animEnemigo(), ver el bloque "APARICION" —
usar ademas los frames propios del pack duplicaria esa animacion) y Attack
(el hongo no tiene ataque a distancia propio en este pase, se integra como
variante del enemigo "normal" que solo ataca por contacto, igual que
goblin_normal y esqueleto).

idealAltoPx se mide con el mismo metodo que ya uso generar_esqueleto_cc0.py:
bbox del canal alpha, tomando el maximo entre las tres tiras (caminar,
daño, muerte) para no recortar el frame mas alto.

Uso:  python tools/generar_hongo_cc0.py
"""
import os

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN = os.path.join(RAIZ, 'recursos', 'enemigos', 'scratchio-big-mushroom')
DESTINO = os.path.join(RAIZ, 'assets', 'enemigos', 'sheets')

CELDA = 29, 28
N_MOV = 6
N_MUERTE = 6
N_COLS = 1 + N_MUERTE  # fila 1: 1 golpe + 6 muerte = ancho de hoja (mayor que los 6 de caminar)


def _bbox_alto(im, ncols):
    miny, maxy = CELDA[1], 0
    for c in range(ncols):
        celda = im.crop((c * CELDA[0], 0, c * CELDA[0] + CELDA[0], CELDA[1]))
        bbox = celda.split()[-1].getbbox()
        if bbox:
            miny = min(miny, bbox[1])
            maxy = max(maxy, bbox[3])
    return maxy - miny


def main():
    os.makedirs(DESTINO, exist_ok=True)
    caminar = Image.open(os.path.join(ORIGEN, 'Big Mushroom_Walk.png')).convert('RGBA')
    dano = Image.open(os.path.join(ORIGEN, 'Big Mushroom_Hurt.png')).convert('RGBA')
    muerte = Image.open(os.path.join(ORIGEN, 'Big Mushroom_Die.png')).convert('RGBA')
    assert caminar.size == (CELDA[0] * N_MOV, CELDA[1]), caminar.size
    assert dano.size == CELDA, dano.size
    assert muerte.size == (CELDA[0] * N_MUERTE, CELDA[1]), muerte.size

    alto = max(_bbox_alto(caminar, N_MOV), _bbox_alto(dano, 1), _bbox_alto(muerte, N_MUERTE))

    ancho = CELDA[0] * N_COLS
    hoja = Image.new('RGBA', (ancho, CELDA[1] * 2), (0, 0, 0, 0))
    hoja.paste(caminar, (0, 0))
    fila_golpe = Image.new('RGBA', (ancho, CELDA[1]), (0, 0, 0, 0))
    fila_golpe.paste(dano, (0, 0))
    fila_golpe.paste(muerte, (CELDA[0], 0))
    hoja.paste(fila_golpe, (0, CELDA[1]))

    hoja = hoja.quantize(colors=32, method=Image.Quantize.FASTOCTREE)
    ruta = os.path.join(DESTINO, 'hongo.png')
    hoja.save(ruta, optimize=True)
    print(f'hongo.png {hoja.size} idealAltoPx={alto} -> {os.path.getsize(ruta)} bytes')


if __name__ == '__main__':
    main()
