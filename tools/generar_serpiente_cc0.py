# -*- coding: utf-8 -*-
"""
DUENDE QUEST — hoja de animacion de la serpiente/cobra (Grotto Escape 2 -
Snake, CC0 — ver recursos/enemigos/ansimuz-sideview-fantasy/Grotto-escape-2-snake,
mismo pack que ya dio el lagarto) para el bioma DESIERTO DORADO, junto al
goblin samurai y el lagarto (la sugerencia original de recursos/INDICE.md ya
emparejaba lagarto+serpiente en desierto: ambas son fauna de cañon rocoso).

Tercer enemigo no-humanoide con rejilla propia (celda 27x20 para caminar,
24x20 para daño — el pack NO comparte columnas entre tiras, cada animacion
es su propio PNG suelto, igual que el lagarto). Medido con PIL (bbox del
canal alpha por columna, NO la documentacion del pack, que en packs
anteriores estuvo mal) antes de escribir este packer:
  walk.png (108x20): 4 frames de 27x20, dibujo de hasta 18 px de alto
                      (cobra irguiendose en S, no un desplazamiento de patas:
                      se ve bien en loop porque ya se mueve por el suelo via
                      code, igual que el resto de sheetPorBioma).
  hurt.png  (72x20): 3 frames de 24x20; el ultimo frame se encoge/repliega
                      (12 px menos de ancho visible) hasta quedar mas chico
                      que el primero, igual que el arco del lagarto.
Ambas tiras coinciden en tamaño con lo que documenta FRAMES.txt esta vez.

Sin frames de muerte: el pack solo trae idle/walk/hurt/jump/shoot/spit/
spring para esta cobra (ni "die" ni "KO"). Igual que el lagarto, se resuelve
nMuerte=1 reusando el ULTIMO frame de "hurt" (el mas replegado/pequeño) como
pose de colapso: sheetFrame()/animEnemigo() en engine.js ya hacen fade-out
por alpha para todo enemigo con e.sheet durante e.muriendo, asi que no hace
falta un dibujo de "panza arriba" — el frame estatico desvaneciendose ya se
lee como agonia.

idealAltoPx = maximo entre el bbox de caminar y el de daño (igual metodo que
generar_lagarto_cc0.py).

Uso:  python tools/generar_serpiente_cc0.py
"""
import os

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN = os.path.join(RAIZ, 'recursos', 'enemigos', 'ansimuz-sideview-fantasy',
                       'Grotto-escape-2-snake', 'PNG', 'spritesheets')
DESTINO = os.path.join(RAIZ, 'assets', 'enemigos', 'sheets')

CELDA_MOV = 27, 20
CELDA_GOLPE = 24, 20
N_MOV = 4
N_GOLPE = 3
N_MUERTE = 1  # reusa el ultimo frame de hurt (ver docstring); no hay frame de muerte real
N_COLS = max(N_MOV, N_GOLPE + N_MUERTE)
FH = 20  # alto de celda comun a ambas tiras


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
    caminar = Image.open(os.path.join(ORIGEN, 'walk.png')).convert('RGBA')
    dano = Image.open(os.path.join(ORIGEN, 'hurt.png')).convert('RGBA')
    assert caminar.size == (CELDA_MOV[0] * N_MOV, FH), caminar.size
    assert dano.size == (CELDA_GOLPE[0] * N_GOLPE, FH), dano.size

    alto = max(
        _bbox_alto(caminar, N_MOV, CELDA_MOV[0], FH),
        _bbox_alto(dano, N_GOLPE, CELDA_GOLPE[0], FH),
    )

    # Ancho de celda final: el mayor de los dos (27), para no recortar la
    # cobra erguida de "caminar". La tira de daño (celdas de 24) se pega
    # centrada horizontalmente en celdas de 27 para no desplazar el dibujo.
    FW = max(CELDA_MOV[0], CELDA_GOLPE[0])
    offset_golpe = (FW - CELDA_GOLPE[0]) // 2

    ultimo_hurt = dano.crop((CELDA_GOLPE[0] * (N_GOLPE - 1), 0, CELDA_GOLPE[0] * N_GOLPE, FH))

    ancho = FW * N_COLS
    hoja = Image.new('RGBA', (ancho, FH * 2), (0, 0, 0, 0))

    fila_mov = Image.new('RGBA', (ancho, FH), (0, 0, 0, 0))
    for c in range(N_MOV):
        frame = caminar.crop((c * CELDA_MOV[0], 0, c * CELDA_MOV[0] + CELDA_MOV[0], FH))
        fila_mov.paste(frame, (c * FW, 0))
    hoja.paste(fila_mov, (0, 0))

    fila_golpe = Image.new('RGBA', (ancho, FH), (0, 0, 0, 0))
    for c in range(N_GOLPE):
        frame = dano.crop((c * CELDA_GOLPE[0], 0, c * CELDA_GOLPE[0] + CELDA_GOLPE[0], FH))
        fila_golpe.paste(frame, (c * FW + offset_golpe, 0))
    fila_golpe.paste(ultimo_hurt, (N_GOLPE * FW + offset_golpe, 0))  # col 3: "muerte" reusando el hurt mas replegado
    hoja.paste(fila_golpe, (0, FH))

    hoja = hoja.quantize(colors=32, method=Image.Quantize.FASTOCTREE)
    ruta = os.path.join(DESTINO, 'serpiente.png')
    hoja.save(ruta, optimize=True)
    print(f'serpiente.png {hoja.size} idealAltoPx={alto} fw={FW} fh={FH} -> {os.path.getsize(ruta)} bytes')


if __name__ == '__main__':
    main()
