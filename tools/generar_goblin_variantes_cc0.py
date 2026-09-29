# -*- coding: utf-8 -*-
"""
DUENDE QUEST — hojas de animacion de dos variantes MAS del goblin, del mismo
pack CC0 Goblin Corps (Moikmellah, ver recursos/enemigos/moikmellah-goblin-corps)
que ya se uso para goblin_normal (variante "soldier", ver generar_enemigos_cc0.py).

Por que estas dos y no otras: FRAMES.txt del pack confirma que las 10
variantes de full/ comparten la MISMA rejilla 320x256 (10 col x 4 filas,
celda 32x64) y la MISMA distribucion de columnas por fila (fila 0 = idle+
caminar+salto, fila 1 = stand+daño+daño-aire+KO). Aun asi no se confio en el
texto: se recortaron y se miraron con el Read tool las filas 0-1 de soldier,
samurai, mage y peasant antes de escribir este script, para confirmar que
ninguna variante desplaza sus columnas (ver conversacion de la tanda que
agrego este script). Las cuatro coinciden exactamente con soldier.

Se eligieron samurai (DESIERTO DORADO — sombrero conico, encaja con un bioma
arido) y mage (TORMENTA ARCANA — tunica y capucha morada, encaja con un
bioma de magia) para dar variedad de bestiario a esos dos biomas, que hasta
ahora solo tenian el goblin "normal" (tormenta ademas ya alterna con el
esqueleto). Peasant se descarto por ahora para no meter una cuarta hoja en
esta tanda; el pack tiene otras 6 variantes sin usar (assassin, battleLord,
centurion, guard, knight, lord) para el futuro.

idealAltoPx se mide por variante (no se reusa el 33 de soldier): cada gorro
o capucha cambia la altura real del dibujo dentro de la celda 32x64.

Uso:  python tools/generar_goblin_variantes_cc0.py
"""
import os

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN_DIR = os.path.join(RAIZ, 'recursos', 'enemigos', 'moikmellah-goblin-corps', 'full')
DESTINO = os.path.join(RAIZ, 'assets', 'enemigos', 'sheets')

CELDA = 32, 64
FILAS = 2  # fila 0 (idle/caminar) + fila 1 (daño/KO); igual recorte que goblin_normal

# variante_pack -> nombre_salida
VARIANTES = {
    'samurai': 'goblin_samurai',
    'mage': 'goblin_mage',
}


def _bbox_alto(im, fila, cols):
    """Altura real (px) del dibujo dentro de la celda, midiendo el canal alpha
    de cada columna indicada y quedandose con la caja mas alta. Evita asumir
    un idealAltoPx fijo cuando el gorro/capucha cambia por variante."""
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
        alto = _bbox_alto(im, 0, range(1, 7))  # bbox del ciclo de caminar (fila 0, col 1-6)
        recorte = im.crop((0, 0, CELDA[0] * 10, CELDA[1] * FILAS))
        recorte = recorte.quantize(colors=48, method=Image.Quantize.FASTOCTREE)
        ruta = os.path.join(DESTINO, f'{nombre}.png')
        recorte.save(ruta, optimize=True)
        print(f'{nombre}.png {recorte.size} idealAltoPx={alto} -> {os.path.getsize(ruta)} bytes')


if __name__ == '__main__':
    main()
