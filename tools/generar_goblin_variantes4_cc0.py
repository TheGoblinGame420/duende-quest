# -*- coding: utf-8 -*-
"""
DUENDE QUEST — hojas de animacion de DOS variantes MAS del goblin, del mismo
pack CC0 Goblin Corps (Moikmellah, ver recursos/enemigos/moikmellah-goblin-corps)
que ya dio goblin_normal/soldier, goblin_samurai/goblin_mage,
goblin_peasant/goblin_assassin y goblin_centurion/goblin_battlelord (las
4 tandas anteriores, ver generar_enemigos_cc0.py / generar_goblin_variantes_cc0.py
/ generar_goblin_variantes2_cc0.py / generar_goblin_variantes3_cc0.py).

Quedaban 2 variantes full/ sin usar: guard, knight, lord. recursos/INDICE.md
las describia como "piel gris, armadura metalica generica... se guardan para
un bioma tipo castillo" (que nunca aparecio). Se recortaron y miraron con el
Read tool las filas 0-1 de las 3 antes de decidir (no solo las 2 elegidas):
comparten la misma rejilla 320x256 y la misma distribucion de columnas que
las 8 variantes ya integradas (idle+caminar+salto en fila 0, stand+daño+KO en
fila 1), sin desplazamientos de columna.

Se eligieron guard y knight para AMANECER ROJO, que hasta esta tanda era el
bioma con MENOS variedad (solo goblin_normal + goblin_peasant, 2 opciones
frente a las 4 de los demas biomas):
- guard: armadura gris lisa, penacho verde chico — soldado generico sin
  narrativa fuerte, encaja como guardia de guarnicion en cualquier amanecer.
- knight: misma armadura gris pero con una cresta/mohawk ROJO en el casco —
  el unico de los tres con un color que efectivamente conecta con la paleta
  de AMANECER ROJO (linea de acento '#ff6444' en BIOMES), asi que no es solo
  "el generico de turno".
lord (corona + capa/tunica larga sobre la armadura) se descarta para esta
tanda: la corona lo lee inequivocamente como REALEZA/rey goblin, una
narrativa de "trono/castillo" que ningun bioma actual soporta (a diferencia
de guard/knight, que leen como soldados sin mas, sin necesitar una escena de
corte) — se forzaria una lectura rara ("por que hay un rey goblin patrullando
el amanecer/desierto/tormenta/selva/noche") solo para sumar una variante mas.
Se guarda en recursos/ para el mismo hipotetico bioma castillo que ya
mencionaba INDICE.md.

idealAltoPx se mide por variante (bbox del canal alpha, ciclo de caminar y
daño), igual que en generar_goblin_variantes3_cc0.py: el casco/cresta cambia
la altura real del dibujo dentro de la celda 32x64.

Uso:  python tools/generar_goblin_variantes4_cc0.py
"""
import os

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN_DIR = os.path.join(RAIZ, 'recursos', 'enemigos', 'moikmellah-goblin-corps', 'full')
DESTINO = os.path.join(RAIZ, 'assets', 'enemigos', 'sheets')

CELDA = 32, 64
FILAS = 2  # fila 0 (idle/caminar) + fila 1 (daño/KO); igual recorte que las variantes previas

# variante_pack -> nombre_salida
VARIANTES = {
    'guard': 'goblin_guard',
    'knight': 'goblin_knight',
}


def _bbox_alto(im, fila, cols):
    """Altura real (px) del dibujo dentro de la celda, midiendo el canal alpha
    de cada columna indicada y quedandose con la caja mas alta."""
    miny, maxy = CELDA[1], 0
    for c in cols:
        celda = im.crop((c * CELDA[0], fila * CELDA[1], c * CELDA[0] + CELDA[0], fila * CELDA[1] + CELDA[1]))
        bbox = celda.split()[-1].getbbox()
        if bbox:
            miny = min(miny, bbox[1])
            maxy = max(maxy, bbox[3])
    return maxy - miny


def main():
    os.makedirs(DESTINO, exist_ok=True)
    for variante, nombre in VARIANTES.items():
        origen = os.path.join(ORIGEN_DIR, f'goblin.{variante}.png')
        im = Image.open(origen).convert('RGBA')
        alto_caminar = _bbox_alto(im, 0, range(1, 7))  # fila 0, col 1-6 (caminar)
        alto_dano = _bbox_alto(im, 1, range(1, 3))     # fila 1, col 1-2 (daño)
        alto = max(alto_caminar, alto_dano)
        recorte = im.crop((0, 0, CELDA[0] * 10, CELDA[1] * FILAS))
        recorte = recorte.quantize(colors=48, method=Image.Quantize.FASTOCTREE)
        ruta = os.path.join(DESTINO, f'{nombre}.png')
        recorte.save(ruta, optimize=True)
        print(f'{nombre}.png {recorte.size} idealAltoPx={alto} -> {os.path.getsize(ruta)} bytes')


if __name__ == '__main__':
    main()
