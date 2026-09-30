# -*- coding: utf-8 -*-
"""
DUENDE QUEST — hoja de animacion del "flying-bird" (Sideview Fantasy Patreon
Collection, ansimuz, CC0 — ver
recursos/enemigos/ansimuz-sideview-fantasy/flying-bird, mismo pack que ya dio
lagarto/serpiente/rana/fantasma) para el bioma AMANECER ROJO, sumandose a
goblin_normal/goblin_peasant/goblin_guard/goblin_knight (ver
generar_goblin_variantes4_cc0.py — esta misma tanda ya llevo dos variantes
del goblin ahi).

recursos/INDICE.md marcaba este sprite como "pajaro -> cualquiera" (sin
bioma fijo). Se eligio AMANECER en vez de otra opcion porque "pajaros al
amanecer" es la lectura mas directa posible, y porque AMANECER era el bioma
con menos variedad de todo el juego antes de esta tanda (2 variantes).

El pack trae DOS paletas del mismo ciclo, mismos 7 frames: sprites/
flying-creature-cycle.png (paloma/ave rapaz color crema/hueso, mas neutra) y
flying-creature-cycle-skin.png (loro/guacamayo azul y naranja, mas vistoso).
Se uso la version CREMA (sin "-skin"): el guacamayo azul/naranja lee mas
"tropical" y hubiera encajado mejor en SELVA (que en esta tanda ya suma la
rana y se hubiera quedado con 6 variantes, ver generar_rana_cc0.py); el ave
crema/hueso es mas neutra y funciona igual de bien como silueta generica de
"ave" al amanecer sin arrastrar una lectura de selva a otro bioma.

Medido con PIL (bbox del canal alpha por celda): 224x32, 7 frames de 32x32.
Ciclo de vuelo continuo (aleteo), sin tags de animacion separados — el ala
sube y baja pero el ave no muestra una pose de "posarse" o "caer" propia.

Sin frames de daño ni muerte propios: se usan los 7 frames como movimiento
(nMov=7) y se reusan los frames 0 y 6 (las dos posturas de ala mas
extendida/asimetrica del ciclo, bbox mas alto) como flash de golpe, y el
frame 0 otra vez como pose de colapso (una silueta con el ala echada hacia
atras, la que mas se parece a "cayendo en picada") — mismo patron de reuso
de ciclo que ghoul_ardiente/fantasma.

idealAltoPx = maximo bbox de alto entre TODOS los frames (0-6).

Uso:  python tools/generar_pajaro_cc0.py
"""
import os

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN = os.path.join(RAIZ, 'recursos', 'enemigos', 'ansimuz-sideview-fantasy', 'flying-bird', 'sprites')
DESTINO = os.path.join(RAIZ, 'assets', 'enemigos', 'sheets')

CELDA = 32, 32
N_TOTAL = 7       # unico ciclo de vuelo, sin tags separados
N_MOV = 7
GOLPE_IDX = [6, 0]   # las dos posturas de ala mas extendida/asimetrica del ciclo
MUERTE_IDX = [0]     # ala echada hacia atras, la mas parecida a "en picada"
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
    tira = Image.open(os.path.join(ORIGEN, 'flying-creature-cycle.png')).convert('RGBA')
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
    ruta = os.path.join(DESTINO, 'pajaro.png')
    hoja.save(ruta, optimize=True)
    print(f'pajaro.png {hoja.size} idealAltoPx={alto} -> {os.path.getsize(ruta)} bytes')


if __name__ == '__main__':
    main()
