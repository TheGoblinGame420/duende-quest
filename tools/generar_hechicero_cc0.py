# -*- coding: utf-8 -*-
"""
DUENDE QUEST — hoja de animacion del "wizard" (GothicVania Church, ansimuz,
CC0 — ver recursos/mapas/ansimuz-gothicvania-church/SPRITES/wizard, mismo
pack que dio el angel y el ghoul en llamas) para el bioma NOCHE, sumandose a
goblin_normal/esqueleto/goblin_assassin.

recursos/INDICE.md marcaba este sprite como "mini-jefe candidato" sin
revisar. Se miro con el Read tool (previews/idle.gif, previews/fire.gif,
previews/big-all-preview.gif) antes de decidir: es un hechicero encapuchado
tunica violeta/magenta, celda 81x66 — mas ancho que un goblin (32x64) por la
tunica, pero de una altura de dibujo real parecida (ver bbox abajo) y sin
ninguna pose "de jefe" (sin fase 2, sin telegrafiado propio, sin animacion de
salto/embestida como el oso o el angel). No se ve claramente mas grande o
mas dramatico que el resto del bestiario "normal": se integra como enemigo
normal en vez de forzar un jefe nuevo sin poder probarlo en partida (ver
angel/tools/generar_angel_cc0.py para el patron de jefe, que aqui NO aplica).

Se eligio NOCHE en vez de TORMENTA (la sugerencia original de
recursos/INDICE.md, pensada para cuando esto era candidato a jefe): TORMENTA
ya tiene un lanzador de hechizos (goblin_mage) y en esta misma tanda suma al
ghoul en llamas (ver generar_ghoul_ardiente_cc0.py), asi que hubiera quedado
con 5 variantes mientras NOCHE se quedaba en 3. La tunica violeta oscura y la
capucha leen mejor como "nigromante de cementerio" junto al esqueleto y el
goblin assassin (ambos ya "acechan de noche", ver CREDITOS.md) que como
clima de tormenta.

La clave interna es 'hechicero', NO 'mago': ese nombre ya lo usa la prosa de
CREDITOS.md para referirse a goblin_mage (la variante de Goblin Corps que va
a TORMENTA). Llamar 'mago' tambien a este sprite hubiera creado ambiguedad
entre dos enemigos distintos en la misma documentacion.

Frame layout (medido con PIL, bbox del canal alpha por columna, NO solo el
wizard.json del pack): spritesheet/wizard.png es 1215x66, 15 frames de
81x66. El JSON SI acierta esta vez con dos tags: "Idle" (frames 0-4, bbox
41-42 px de alto, gesto de manos quieto — el pack NO trae una tira de
"caminar" con piernas moviendose, es una tunica larga que casi no muestra
pies) e "Fire" (frames 5-14, un conjuro que crece: 41 px al empezar hasta 53
px en el frame 12 con las manos bien arriba, y termina en el frame 14 con un
gesto ancho de descarga, 38x51).

Sin caminar "de verdad" ni daño/muerte propios. Se resuelve iguel que
lagarto/serpiente cuando su "caminar" tampoco mostraba desplazamiento de
piernas (ver docstring de generar_serpiente_cc0.py): el ciclo de Idle sirve
de fila de movimiento porque el desplazamiento en X ya lo hace el codigo del
motor, no el dibujo — en loop se ve como que "flota/gesticula" mientras
avanza, no como que camina, pero es el mismo patron ya usado. Para golpe se
tomaron 3 frames de "Fire" (7, 10 y 12: el conjuro subiendo de intensidad)
en vez de una foto fija, para que el flash de golpe se vea como que el
hechicero esta canalizando mas fuerte; para muerte se reusa el frame 14 (el
gesto de descarga final, distinto de los 3 de golpe) como pose de colapso,
con el fade-out por alpha de siempre.

N_COLS = 5 (igual que N_MOV): los 3 de golpe + 1 de muerte (4 columnas)
entran sin necesitar mas ancho que la fila de movimiento.

idealAltoPx = maximo bbox de alto entre TODOS los frames usados (idle +
golpe + muerte), igual metodo que el resto de packers.

Uso:  python tools/generar_hechicero_cc0.py
"""
import os

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN = os.path.join(RAIZ, 'recursos', 'mapas', 'ansimuz-gothicvania-church', 'SPRITES', 'wizard', 'spritesheet')
DESTINO = os.path.join(RAIZ, 'assets', 'enemigos', 'sheets')

CELDA = 81, 66
N_TOTAL = 15       # 0-4 idle, 5-14 fire (segun wizard.json)
N_MOV = 5          # idle: frames 0-4
GOLPE_IDX = [7, 10, 12]   # fire: conjuro subiendo de intensidad
MUERTE_IDX = [14]         # fire: gesto de descarga final
N_COLS = max(N_MOV, len(GOLPE_IDX) + len(MUERTE_IDX))


def _bbox_alto(frames, idxs):
    miny, maxy = CELDA[1], 0
    for i in idxs:
        bbox = frames[i].split()[-1].getbbox()
        if bbox:
            miny = min(miny, bbox[1])
            maxy = max(maxy, bbox[3])
    return maxy - miny


def main():
    os.makedirs(DESTINO, exist_ok=True)
    tira = Image.open(os.path.join(ORIGEN, 'wizard.png')).convert('RGBA')
    assert tira.size == (CELDA[0] * N_TOTAL, CELDA[1]), tira.size
    frames = [tira.crop((i * CELDA[0], 0, i * CELDA[0] + CELDA[0], CELDA[1])) for i in range(N_TOTAL)]

    usados = list(range(N_MOV)) + GOLPE_IDX + MUERTE_IDX
    alto = _bbox_alto(frames, usados)

    ancho = CELDA[0] * N_COLS
    hoja = Image.new('RGBA', (ancho, CELDA[1] * 2), (0, 0, 0, 0))
    for i in range(N_MOV):
        hoja.paste(frames[i], (i * CELDA[0], 0))
    for i, idx in enumerate(GOLPE_IDX):
        hoja.paste(frames[idx], (i * CELDA[0], CELDA[1]))
    for i, idx in enumerate(MUERTE_IDX):
        hoja.paste(frames[idx], ((len(GOLPE_IDX) + i) * CELDA[0], CELDA[1]))

    hoja = hoja.quantize(colors=48, method=Image.Quantize.FASTOCTREE)
    ruta = os.path.join(DESTINO, 'hechicero.png')
    hoja.save(ruta, optimize=True)
    print(f'hechicero.png {hoja.size} idealAltoPx={alto} -> {os.path.getsize(ruta)} bytes')


if __name__ == '__main__':
    main()
