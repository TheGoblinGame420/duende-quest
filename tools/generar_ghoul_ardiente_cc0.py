# -*- coding: utf-8 -*-
"""
DUENDE QUEST — hoja de animacion del "burning-ghoul" (GothicVania Church,
ansimuz, CC0 — ver recursos/mapas/ansimuz-gothicvania-church/SPRITES/burning-ghoul,
mismo pack que ya dio el angel) para el bioma TORMENTA ARCANA, sumandose a
goblin_normal/esqueleto/goblin_mage: hasta esta tanda ese bioma no tenia
ningun enemigo de fuego, solo "arcano" (rayo/hechizo). recursos/INDICE.md ya
lo marcaba como "el enemigo de fuego que faltaba, sin usar todavia".

Cuarto enemigo no-humanoide (goblin_normal es el unico humanoide reskineado
que aparece en todos los biomas; hongo/lagarto/serpiente fueron los otros
tres). El pack trae DOS variantes de paleta (v1 y v2) con la MISMA pose de
carrera, solo cambia el tinte de la llama/ropa; se uso v1 porque es la que
documenta recursos/INDICE.md (57x60) y va bien con la paleta violeta/azul de
TORMENTA. v2 (naranja mas saturado) queda en el pack por si se quiere una
variante "elite" mas adelante.

Medido con PIL (bbox del canal alpha por columna, NO el FRAMES.txt del pack,
que en tandas anteriores estuvo mal) antes de escribir este packer:
  spritesheet/v1/burning-ghoul.png (456x60): 8 frames de 57x60, TODOS tocan
  el borde inferior de la celda (bbox[3]==60 en las 8), o sea que el pie de
  apoyo esta fijo abajo y solo varia la altura de la cabeza/llama (41-47 px)
  — exactamente el patron de un ciclo de correr/caminar con la carrera ya
  puesta en pie (nunca "flota").
  El JSON (spritesheet/v1/burning-ghoul.json) solo etiqueta frames 0-6 como
  el tag de animacion (7 de los 8); el frame 7 queda FUERA del tag y es el
  que mas altura/anchura tiene (47x41, brazo mas extendido hacia adelante) —
  se interpreto como una pose de "impacto"/zancada final, asi que se reusa
  para golpe/muerte en vez de en el ciclo de movimiento (igual que v2, que SI
  separa "run 1"/"run 2" como dos tandas de 8 en vez de una sola: confirma
  que la pose de este pack es todo el rato "correr", nunca ataque cuerpo a
  cuerpo).

Sin frames de daño ni muerte propios (mismo problema que lagarto/serpiente/
angel: el pack no trae "hurt" ni "die" para este enemigo). Se resuelve
reusando frame 6 (fin de zancada, brazo ya adelantado) + frame 7 (el
excluido del tag, el mas extendido) como flash de golpe de 2 cuadros, y
frame 7 otra vez como pose de "muerte" (nMuerte=1): el fade-out por alpha
que animEnemigo() ya aplica a todo enemigo con e.sheet durante e.muriendo
hace el resto, mismo patron que el resto del bestiario sin muerte propia.

idealAltoPx = maximo bbox de alto entre los 8 frames (incluye el frame 7
reusado en golpe/muerte), igual metodo que el resto de packers.

Uso:  python tools/generar_ghoul_ardiente_cc0.py
"""
import os

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN = os.path.join(RAIZ, 'recursos', 'mapas', 'ansimuz-gothicvania-church',
                       'SPRITES', 'burning-ghoul', 'spritesheet', 'v1')
DESTINO = os.path.join(RAIZ, 'assets', 'enemigos', 'sheets')

CELDA = 57, 60
N_TOTAL = 8       # frames sueltos en la tira origen
N_MOV = 7         # frames 0-6: el tag "Tag"/"run" del pack (ciclo de carrera)
GOLPE_IDX = [6, 7]   # reusa el ultimo del ciclo + el excluido del tag
MUERTE_IDX = [7]     # el excluido del tag: pose mas extendida, sirve de colapso
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
    tira = Image.open(os.path.join(ORIGEN, 'burning-ghoul.png')).convert('RGBA')
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
    ruta = os.path.join(DESTINO, 'ghoul_ardiente.png')
    hoja.save(ruta, optimize=True)
    print(f'ghoul_ardiente.png {hoja.size} idealAltoPx={alto} -> {os.path.getsize(ruta)} bytes')


if __name__ == '__main__':
    main()
