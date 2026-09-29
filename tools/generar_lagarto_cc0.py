# -*- coding: utf-8 -*-
"""
DUENDE QUEST — hoja de animacion del lagarto (Grotto Escape 2 - Lizzard, CC0
— ver recursos/enemigos/ansimuz-sideview-fantasy/Grotto-escape-2-lizzard)
para el bioma DESIERTO DORADO, junto al goblin_samurai.

Segundo enemigo animado que NO es un humanoide reskineado (el primero fue el
hongo, ver generar_hongo_cc0.py), y el primero con rejilla propia MUY chica
(celda 64x32, dibujo real de solo 11-17 px de alto) sacada de tiras PNG
sueltas (el pack de ansimuz trae una tira por animacion, sin fila/columna
compartida con los goblins): walk.png, hurt.png, idle.png, jump.png,
tongue.png (ataque a distancia, no usado aqui).

Medido con PIL (bbox del canal alpha por columna, no la documentacion del
pack) antes de escribir el packer:
  walk.png  (384x32): 6 frames de 64x32, dibujo de 11-12 px de alto.
  hurt.png  (192x32): 3 frames de 64x32; los frames 1-2 (0-indexed) se
                       arquean hacia atras y llegan a 17 px de alto.
Ambas tiras coinciden en tamaño con lo que documenta FRAMES.txt.

Sin frames de muerte: el pack solo trae idle/walk/run/jump/hurt/tongue (ni
"die" ni "KO"), a diferencia del goblin/esqueleto/hongo. Igual que hongo
resolvio nGolpe=1 sin tocar el motor, aqui se resuelve nMuerte=1 reusando el
ULTIMO frame de hurt (el mas encogido/arqueado, el que mas se parece a un
golpe fuerte) como pose de "muerte": sheetFrame() en engine.js ya hace
fade-out por alpha para todo enemigo con e.sheet durante e.muriendo (ver
animEnemigo(), bloque MUERTE: "if (e.sheet) return a"), asi que un frame
estatico desvaneciendose se lee bien como agonia/colapso sin necesitar un
dibujo de "tirado en el suelo" como los humanoides.

idealAltoPx se mide igual que en generar_hongo_cc0.py: bbox del canal alpha,
maximo entre caminar y daño (17 px, de los frames de hurt).

Uso:  python tools/generar_lagarto_cc0.py
"""
import os

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN = os.path.join(RAIZ, 'recursos', 'enemigos', 'ansimuz-sideview-fantasy',
                       'Grotto-escape-2-lizzard', 'PNG', 'spritesheets')
DESTINO = os.path.join(RAIZ, 'assets', 'enemigos', 'sheets')

CELDA = 64, 32
N_MOV = 6
N_GOLPE = 3
N_MUERTE = 1  # reusa el ultimo frame de hurt (ver docstring); no hay frame de muerte real
N_COLS = max(N_MOV, N_GOLPE + N_MUERTE)


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
    caminar = Image.open(os.path.join(ORIGEN, 'walk.png')).convert('RGBA')
    dano = Image.open(os.path.join(ORIGEN, 'hurt.png')).convert('RGBA')
    assert caminar.size == (CELDA[0] * N_MOV, CELDA[1]), caminar.size
    assert dano.size == (CELDA[0] * N_GOLPE, CELDA[1]), dano.size

    alto = max(_bbox_alto(caminar, N_MOV), _bbox_alto(dano, N_GOLPE))

    ultimo_hurt = dano.crop((CELDA[0] * (N_GOLPE - 1), 0, CELDA[0] * N_GOLPE, CELDA[1]))

    ancho = CELDA[0] * N_COLS
    hoja = Image.new('RGBA', (ancho, CELDA[1] * 2), (0, 0, 0, 0))
    hoja.paste(caminar, (0, 0))
    fila_golpe = Image.new('RGBA', (ancho, CELDA[1]), (0, 0, 0, 0))
    fila_golpe.paste(dano, (0, 0))
    fila_golpe.paste(ultimo_hurt, (CELDA[0] * N_GOLPE, 0))  # col 3: "muerte" reusando el hurt mas marcado
    hoja.paste(fila_golpe, (0, CELDA[1]))

    hoja = hoja.quantize(colors=32, method=Image.Quantize.FASTOCTREE)
    ruta = os.path.join(DESTINO, 'lagarto.png')
    hoja.save(ruta, optimize=True)
    print(f'lagarto.png {hoja.size} idealAltoPx={alto} -> {os.path.getsize(ruta)} bytes')


if __name__ == '__main__':
    main()
