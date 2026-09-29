# -*- coding: utf-8 -*-
"""
DUENDE QUEST — hojas de animacion de DOS variantes MAS del goblin, del mismo
pack CC0 Goblin Corps (Moikmellah, ver recursos/enemigos/moikmellah-goblin-corps)
que ya dio goblin_normal/soldier (generar_enemigos_cc0.py), goblin_samurai/
goblin_mage (generar_goblin_variantes_cc0.py) y goblin_peasant/goblin_assassin
(generar_goblin_variantes2_cc0.py).

Quedaban 4 variantes full/ sin usar: battleLord, centurion, guard, knight,
lord (lord tampoco se uso). Se recortaron y miraron con el Read tool las
filas 0-1 de las 5 (no solo las 2 elegidas) antes de decidir — comparten la
misma rejilla 320x256 y la misma distribucion de columnas que las 5 variantes
ya integradas (idle+caminar+salto en fila 0, stand+daño+KO en fila 1), sin
desplazamientos de columna.

Se eligieron centurion y battleLord para SELVA ESMERALDA (bioma 2), que
hasta esta tanda era el bioma con MENOS variedad (solo goblin_normal + hongo,
2 opciones frente a las 3 de los demas biomas):
- centurion: piel canela, vincha roja, torso desnudo con hombreras de cuero
  y lanza — lectura de "guerrero tribal de la jungla", no de soldado
  uniformado como samurai/mage/peasant/assassin.
- battleLord: mismo tono de piel, cresta azul tipo mohawk, armadura de cuero
  con placas — lectura de "jefe de guerra tribal", coherente con centurion
  para que ambos convivan en la misma oleada sin sentirse repetidos (uno es
  tropa, el otro un lider mas grande/fiero).
guard, knight y lord (piel gris, armadura metalica genérica de "guardia de
castillo") se descartaron para esta tanda: no encajan con jungla y se
guardan para un bioma con castillo/fortaleza si aparece mas adelante.

idealAltoPx se mide por variante (bbox del canal alpha, ciclo de caminar y
daño), igual que en generar_goblin_variantes2_cc0.py: el gorro/vincha/cresta
cambia la altura real del dibujo dentro de la celda 32x64.

Uso:  python tools/generar_goblin_variantes3_cc0.py
"""
import os

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN_DIR = os.path.join(RAIZ, 'recursos', 'enemigos', 'moikmellah-goblin-corps', 'full')
DESTINO = os.path.join(RAIZ, 'assets', 'enemigos', 'sheets')

CELDA = 32, 64
FILAS = 2  # fila 0 (idle/caminar) + fila 1 (daño/KO); igual recorte que las 5 variantes previas

# variante_pack -> nombre_salida
VARIANTES = {
    'centurion': 'goblin_centurion',
    'battleLord': 'goblin_battlelord',
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
