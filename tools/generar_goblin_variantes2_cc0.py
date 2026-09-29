# -*- coding: utf-8 -*-
"""
DUENDE QUEST — hojas de animacion de DOS variantes MAS del goblin, del mismo
pack CC0 Goblin Corps (Moikmellah, ver recursos/enemigos/moikmellah-goblin-corps)
que ya dio goblin_normal/soldier (generar_enemigos_cc0.py) y goblin_samurai/
goblin_mage (generar_goblin_variantes_cc0.py).

Por que estas dos: quedaban 6 variantes sin usar en full/ (assassin,
battleLord, centurion, guard, knight, lord) mas peasant, que el pase anterior
descarto "por ahora". Se recortaron y miraron con el Read tool las filas 0-1
de las 7 variantes sueltas antes de elegir (no solo peasant/assassin: tambien
guard, knight, battleLord, centurion, lord) — las 7 comparten exactamente la
misma rejilla 320x256 y la misma distribucion de columnas que soldier/
samurai/mage (idle+caminar+salto en fila 0, stand+daño+KO en fila 1), sin
desplazamientos de columna.

Se eligieron:
- peasant (tunica marron, sin casco) para AMANECER ROJO, que hasta ahora
  era el UNICO bioma con un solo enemigo con hoja (goblin_normal a secas).
  Encaja como "aldeano/campesino" de un amanecer, en vez de un guerrero.
- assassin (capucha y traje azul-morado oscuro, ojos verdes brillantes) para
  NOCHE, que ya alternaba goblin_normal/esqueleto: un goblin sigiloso vestido
  de oscuro para acechar de noche es una mejor lectura visual que un tercer
  humanoide gris/dorado (guard/knight/centurion), que se guardan para otra
  tanda.

idealAltoPx se mide por variante, igual que en generar_goblin_variantes_cc0.py
(el gorro/capucha cambia la altura real del dibujo dentro de la celda 32x64).

Uso:  python tools/generar_goblin_variantes2_cc0.py
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
    'peasant': 'goblin_peasant',
    'assassin': 'goblin_assassin',
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
