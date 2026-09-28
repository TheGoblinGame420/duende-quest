# -*- coding: utf-8 -*-
"""
DUENDE QUEST — hoja de animacion del goblin "normal" a partir del pack CC0
Goblin Corps (Moikmellah, ver recursos/enemigos/moikmellah-goblin-corps).

Hasta ahora el enemigo mas comun del juego era UN bitmap estatico deformado
por codigo (escala/rotacion) para simular caminar, recibir daño y morir. Esta
hoja trae ciclos de verdad: 6 frames de caminar, 2 de daño y 2 de muerte
(cuerpo en el suelo), en vez de aproximarlos con transformaciones.

Se recorta a solo las dos filas que usa el motor (fila 0 = idle+caminar,
fila 1 = daño+KO) de las 4 que trae la hoja completa (ataques en fila 2-3,
que el enemigo "normal" no usa: no tiene telegrafiado de ataque, solo
contacto), para no cargar 4 veces mas peso del necesario.

Uso:  python tools/generar_enemigos_cc0.py
"""
import os

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN = os.path.join(RAIZ, 'recursos', 'enemigos', 'moikmellah-goblin-corps', 'full', 'goblin.soldier.png')
DESTINO = os.path.join(RAIZ, 'assets', 'enemigos', 'sheets')

CELDA = 32, 64
FILAS = 2  # fila 0 (idle/caminar) + fila 1 (daño/KO); se descartan las de ataque


def main():
    os.makedirs(DESTINO, exist_ok=True)
    im = Image.open(ORIGEN).convert('RGBA')
    recorte = im.crop((0, 0, CELDA[0] * 10, CELDA[1] * FILAS))
    recorte = recorte.quantize(colors=48, method=Image.Quantize.FASTOCTREE)
    ruta = os.path.join(DESTINO, 'goblin_normal.png')
    recorte.save(ruta, optimize=True)
    print(f'goblin_normal.png {recorte.size} -> {os.path.getsize(ruta)} bytes')


if __name__ == '__main__':
    main()
