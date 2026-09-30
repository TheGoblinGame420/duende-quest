# -*- coding: utf-8 -*-
"""
DUENDE QUEST — hoja de animacion del SABUESO INFERNAL (Hell Hound Sprite
Animation, ansimuz, CC0 — ver recursos/enemigos/ansimuz-hell-hound), segundo
JEFE con silueta propia (JEFES en js/engine.js) despues del angel: reemplaza
al oso reciclado SOLO en la etapa 1-3 (NOCHE VIOLETA, el primer jefe de la
campaña) en vez de en la ultima, al reves que el angel.

Descargado desde https://ansimuz.itch.io/hell-hound-sprite-animation (link
"No thanks, just take me to the downloads", $0). El pack no traia FRAMES.txt;
medido con PIL igual que el resto del bestiario (bbox del canal alfa por
celda, nunca el nombre del archivo ni el tamaño total del PNG): 4 tiras
sueltas, cada una con su propia rejilla de celda uniforme (confirmado
buscando las columnas totalmente transparentes que separan cada frame):
  hell-hound-idle.png (384x32): 6 frames de 64x32
  hell-hound-walk.png (768x32): 12 frames de 64x32
  hell-hound-run.png  (335x32): 5 frames de 67x32 (pies ya tocando el borde
                          inferior de la celda en las 5 — anclado abajo)
  hell-hound-jump.png (390x48): 6 frames de 65x48 (arco de salto/ataque; a
                          diferencia de run, el bbox real no siempre toca el
                          borde inferior — el sabueso esta en el aire)

Visto en grande (renders x6-x10 con PIL antes de escribir este script, no
solo el nombre del pack): silueta oscura tipo perro esqueletico, grietas de
lava naranja en el lomo y la cola, ojos celestes brillantes — se lee como
"perro infernal" de verdad, no como un reskin de las criaturas normales del
bestiario (rana/conejo/pajaro), que es la barra que tenia que pasar para
ser JEFE y no enemigo normal.

Sin frames de daño ni muerte propios (mismo problema que el resto del
bestiario salvaje; hasta el pack lo admite en un comentario de la pagina de
descarga: "you only miss the death here"): se usa "run" como movimiento
(nMov=5, ya anclado abajo) y se recortan por bbox dos poses de "jump":
frame 2 (mandibula abierta, cabeza echada atras, patas delanteras recogidas
— la pose mas agresiva de las 6, buena para el flash de golpe) y frame 4
(embestida hacia adelante, patas delanteras extendidas). El frame 2 se
reusa una vez mas como pose de "muerte" (cabeza atras se lee como aullido de
dolor / colapso), mismo patron que fantasma/ghoul_ardiente/angel.

Los recortes de "jump" (hasta 39px de alto) NO caben dentro de la celda de
"run" (32px de alto): a diferencia de conejo (donde "run" SI dominaba en
ambos ejes), aqui hace falta agrandar la celda final a 67x39 y pegar "run"
con un offset vertical para que su propio borde inferior siga cayendo en el
borde inferior de la celda mas alta — mismo truco de anclaje por offset que
ya uso generar_rana_cc0.py, pero aplicado al revés (la fila que domina es la
de golpe/muerte, no la de movimiento).

idealAltoPx = maximo bbox de alto entre TODOS los frames usados (run + los
dos recortes de jump).

Uso:  python tools/generar_hellhound_cc0.py
"""
import os

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN = os.path.join(RAIZ, 'recursos', 'enemigos', 'ansimuz-hell-hound', 'PNG')
DESTINO = os.path.join(RAIZ, 'assets', 'enemigos', 'sheets')

CELDA_RUN = 67, 32
CELDA_JUMP = 65, 48
N_RUN = 5
N_JUMP = 6
GOLPE_IDX = [2, 4]   # mandibula abierta echada atras + embestida hacia adelante
MUERTE_IDX = [2]     # mandibula abierta atras, reusada como aullido de colapso
N_COLS = max(N_RUN, len(GOLPE_IDX) + len(MUERTE_IDX))


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
    correr = Image.open(os.path.join(ORIGEN, 'hell-hound-run.png')).convert('RGBA')
    saltar = Image.open(os.path.join(ORIGEN, 'hell-hound-jump.png')).convert('RGBA')
    assert correr.size == (CELDA_RUN[0] * N_RUN, CELDA_RUN[1]), correr.size
    assert saltar.size == (CELDA_JUMP[0] * N_JUMP, CELDA_JUMP[1]), saltar.size

    recortes = {idx: _recorte_bbox(saltar, idx, *CELDA_JUMP) for idx in set(GOLPE_IDX + MUERTE_IDX)}

    # La celda final tiene que caber ambos ejes: "run" domina el ancho (67 >
    # los ~40-47 de los recortes), pero los recortes de "jump" dominan el
    # alto (hasta 39 > los 32 de "run").
    FW = max(CELDA_RUN[0], max(r.width for r in recortes.values()))
    FH = max(CELDA_RUN[1], max(r.height for r in recortes.values()))
    assert FW == CELDA_RUN[0], ('el ancho de run deberia dominar', FW, CELDA_RUN)

    alto = max(
        _bbox_alto_celdas(correr, N_RUN, *CELDA_RUN),
        max(r.height for r in recortes.values()),
    )

    ancho = FW * N_COLS
    hoja = Image.new('RGBA', (ancho, FH * 2), (0, 0, 0, 0))

    oy_run = FH - CELDA_RUN[1]  # ancla el borde inferior de "run" al borde inferior de la celda mas alta
    for c in range(N_RUN):
        frame = correr.crop((c * CELDA_RUN[0], 0, c * CELDA_RUN[0] + CELDA_RUN[0], CELDA_RUN[1]))
        hoja.paste(frame, (c * FW, oy_run))

    def _pegar_centrado(col, r):
        ox = (FW - r.width) // 2
        oy = FH - r.height  # mismo borde inferior que "run"
        hoja.paste(r, (col * FW + ox, FH + oy))

    for i, idx in enumerate(GOLPE_IDX):
        _pegar_centrado(i, recortes[idx])
    for i, idx in enumerate(MUERTE_IDX):
        _pegar_centrado(len(GOLPE_IDX) + i, recortes[idx])

    hoja = hoja.quantize(colors=48, method=Image.Quantize.FASTOCTREE)
    ruta = os.path.join(DESTINO, 'hellhound.png')
    hoja.save(ruta, optimize=True)
    print(f'hellhound.png {hoja.size} idealAltoPx={alto} fw={FW} fh={FH} -> {os.path.getsize(ruta)} bytes')


if __name__ == '__main__':
    main()
