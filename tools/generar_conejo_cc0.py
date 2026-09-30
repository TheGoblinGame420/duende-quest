# -*- coding: utf-8 -*-
"""
DUENDE QUEST — hoja de animacion del "sunny-bunny" (Sideview Fantasy Patreon
Collection, ansimuz, CC0 — ver
recursos/enemigos/ansimuz-sideview-fantasy/sunny-bunny, mismo pack que ya dio
lagarto/serpiente/rana/fantasma/pajaro) para el bioma DESIERTO DORADO,
sumandose a goblin_normal/goblin_samurai/lagarto/serpiente.

recursos/INDICE.md no traia sugerencia de bioma para esta carpeta (era una de
las dos sin usar del pack, junto a sunny-mushroom). Se eligio DESIERTO por el
nombre "sunny" del pack (vibra soleada/arida) y porque un conejo de
madriguera encaja como fauna de canon rocoso tan bien como el lagarto y la
serpiente que ya estan ahi; ademas DESIERTO era, junto a TORMENTA, uno de los
2 biomas que se habian quedado en 4 enemigos en vez de 5.

Noveno enemigo no-humanoide. Medido con PIL (bbox del canal alpha por celda,
NUNCA solo el nombre del archivo): el pack trae TRES tiras sueltas con celdas
de tamaño distinto cada una:
  sunny-bunny-idle.png (96x42): 4 frames de 24x42 (parado, respirando,
                          variacion minima entre frames — no sirve como pose
                          de golpe/muerte por no ser lo bastante distinta)
  sunny-bunny-run.png  (204x44): 6 frames de 34x44 (correr, bbox alto hasta
                          36px, pies tocando el borde inferior de la celda en
                          casi todos los frames -> ya viene anclado abajo)
  sunny-bunny-jump.png (425x57): 5 frames de 85x57 (arco de salto que recorre
                          TODA la celda ancha, cada frame con el conejo en
                          una posicion X distinta dentro de la celda — mismo
                          problema que sunny-froggy-jump: no se puede pegar
                          la celda entera sin desalinear el personaje, pero
                          a diferencia de la rana, aqui SI hay dos poses
                          aisladas claramente distintas y utiles si se
                          recortan por su propio bbox: frame2 (agazapado en
                          el aire, orejas hacia atras, silueta compacta) y
                          frame3 (extendido, brazos y piernas abiertos en
                          diagonal) — se usan como flash de golpe.

Sin frames de daño ni muerte propios (mismo problema que el resto del
bestiario salvaje): se usa "run" como movimiento (nMov=6, ya viene con los
pies anclados al borde inferior de su propia celda) y se recortan por bbox
los frames 2 y 3 de "jump" como flash de golpe (agazapado + extendido), mas
el frame 2 otra vez como pose de colapso (agazapado se lee como "encogerse
al caer"). Los recortes de jump se repegan centrados horizontalmente y
anclados abajo dentro de la celda final (34x44, la de "run": ambos recortes
de jump caben sin desbordar, bw<=29 y bh<=38), mismo truco de re-anclaje que
ya uso generar_rana_cc0.py para no saltar de tamaño al pasar de mov a golpe.

idealAltoPx = maximo bbox de alto entre TODOS los frames usados (run +
los dos recortes de jump).

Uso:  python tools/generar_conejo_cc0.py
"""
import os

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN = os.path.join(RAIZ, 'recursos', 'enemigos', 'ansimuz-sideview-fantasy', 'sunny-bunny', 'PNG')
DESTINO = os.path.join(RAIZ, 'assets', 'enemigos', 'sheets')

CELDA_RUN = 34, 44
CELDA_JUMP = 85, 57
N_MOV = 6
GOLPE_IDX = [2, 3]   # agazapado en el aire + extendido en diagonal
MUERTE_IDX = [2]     # agazapado, reusado como colapso
N_COLS = max(N_MOV, len(GOLPE_IDX) + len(MUERTE_IDX))

FW, FH = CELDA_RUN  # celda de "run" domina en ambos ejes sobre los recortes de jump


def _bbox_alto_celdas(im, ncols, cw, ch):
    miny, maxy = ch, 0
    for c in range(ncols):
        celda = im.crop((c * cw, 0, c * cw + cw, ch))
        bbox = celda.split()[-1].getbbox()
        if bbox:
            miny = min(miny, bbox[1])
            maxy = max(maxy, bbox[3])
    return maxy - miny


def _recorte_bbox(im, idx, cw, ch):
    celda = im.crop((idx * cw, 0, idx * cw + cw, ch))
    bbox = celda.split()[-1].getbbox()
    return celda.crop(bbox)


def main():
    os.makedirs(DESTINO, exist_ok=True)
    correr = Image.open(os.path.join(ORIGEN, 'sunny-bunny-run.png')).convert('RGBA')
    saltar = Image.open(os.path.join(ORIGEN, 'sunny-bunny-jump.png')).convert('RGBA')
    assert correr.size == (CELDA_RUN[0] * N_MOV, CELDA_RUN[1]), correr.size
    assert saltar.size == (CELDA_JUMP[0] * 5, CELDA_JUMP[1]), saltar.size

    recortes = {idx: _recorte_bbox(saltar, idx, *CELDA_JUMP) for idx in set(GOLPE_IDX + MUERTE_IDX)}
    for idx, r in recortes.items():
        assert r.width <= FW and r.height <= FH, (idx, r.size)

    alto = max(
        _bbox_alto_celdas(correr, N_MOV, *CELDA_RUN),
        max(r.height for r in recortes.values()),
    )

    ancho = FW * N_COLS
    hoja = Image.new('RGBA', (ancho, FH * 2), (0, 0, 0, 0))

    for c in range(N_MOV):
        frame = correr.crop((c * CELDA_RUN[0], 0, c * CELDA_RUN[0] + CELDA_RUN[0], CELDA_RUN[1]))
        hoja.paste(frame, (c * FW, 0))

    def _pegar_centrado(col, r):
        ox = (FW - r.width) // 2
        oy = FH - r.height  # ancla abajo, mismo borde inferior que "run"
        hoja.paste(r, (col * FW + ox, FH + oy))

    for i, idx in enumerate(GOLPE_IDX):
        _pegar_centrado(i, recortes[idx])
    for i, idx in enumerate(MUERTE_IDX):
        _pegar_centrado(len(GOLPE_IDX) + i, recortes[idx])

    hoja = hoja.quantize(colors=48, method=Image.Quantize.FASTOCTREE)
    ruta = os.path.join(DESTINO, 'conejo.png')
    hoja.save(ruta, optimize=True)
    print(f'conejo.png {hoja.size} idealAltoPx={alto} fw={FW} fh={FH} -> {os.path.getsize(ruta)} bytes')


if __name__ == '__main__':
    main()
