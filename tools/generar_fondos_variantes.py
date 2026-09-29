# -*- coding: utf-8 -*-
"""
DUENDE QUEST — segunda variante de fondo para AMANECER y TORMENTA.

tools/generar_fondos_cc0.py ya genero un fondo por bioma reusando Rocky
Pass/Swamp/Cemetery. Quedaban DOS packs CC0 ya descargados y sin tocar:
Sunny Land (pradera soleada) y Castle Platformer/twilight (montañas +
lago nocturno, Jetrel). Se usan aqui como una SEGUNDA variante — el motor
elige una de las dos al azar cada vez que entra a ese bioma (ver
FONDO_VARIANTES en js/engine.js), asi la misma etapa no se ve siempre
igual en la segunda vuelta.

  amanecer2  Sunny Land: cielo+mar de lejos, isla con palmeras de cerca
             (capas ya compuestas de la demo, CC0, ansimuz)
  tormenta2  Castle Platformer: capa de montañas+lago (CC0, Jetrel) de
             lejos, combinada con la MISMA capa cercana que ya usa
             tormenta (pantano) — el otro archivo de esa demo
             (exterior-parallaxBG2.png) es una mascara solida pensada
             para recolorear en un motor con blend modes, no un fondo
             usable tal cual, así que no se usa.
  selva2     Parallax Forest Pack (CC0, ansimuz, descargado 29-sep-2026
             de OpenGameArt buscando expresamente mas variedad de mapas):
             fila de arboles lejana de lejos, fila de arboles cercana
             (troncos oscuros) de cerca. Se probaron antes otros dos packs
             de la misma busqueda: uno de fondos de desierto CC0 (vector
             plano, sin pixel art, no encaja con el estilo del resto del
             juego) y una escena estatica sin capas separadas — ninguno
             de los dos se uso.

Uso:  python tools/generar_fondos_variantes.py
"""
import os

from PIL import Image, ImageEnhance

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R = os.path.join(RAIZ, 'recursos', 'mapas')
SALIDA = os.path.join(RAIZ, 'assets', 'fondos')

SUNNY = os.path.join(R, 'ansimuz-sunny-land', 'mapa-demo', 'environment')
CASTLE = os.path.join(R, 'jetrel-castle-twilight')
PAN = os.path.join(R, 'ansimuz-gothicvania-swamp', 'Evironment')
BOSQUE = os.path.join(R, 'ansimuz-forest-background', 'parallax_forest_pack', 'layers')


def procesar(im, brillo):
    im = im.convert('RGBA')
    rgb = ImageEnhance.Brightness(im.convert('RGB')).enhance(brillo)
    rgb.putalpha(im.getchannel('A'))
    return rgb


def guardar(im, nombre):
    ruta = os.path.join(SALIDA, nombre)
    im.save(ruta, optimize=True)
    print(f'{nombre} {im.size} -> {os.path.getsize(ruta)} bytes')


def main():
    os.makedirs(SALIDA, exist_ok=True)

    lejos = procesar(Image.open(f'{SUNNY}/back.png'), .70)
    cerca = procesar(Image.open(f'{SUNNY}/middle.png'), .55)
    guardar(lejos, 'amanecer2_lejos.png')
    guardar(cerca, 'amanecer2_cerca.png')

    lejos = procesar(Image.open(f'{CASTLE}/exterior-parallaxBG1.png'), .60)
    cerca = procesar(Image.open(f'{PAN}/mid-layer-02.png'), .55)
    guardar(lejos, 'tormenta2_lejos.png')
    guardar(cerca, 'tormenta2_cerca.png')

    lejos = procesar(Image.open(f'{BOSQUE}/parallax-forest-back-trees.png'), .58)
    cerca = procesar(Image.open(f'{BOSQUE}/parallax-forest-front-trees.png'), .50)
    guardar(lejos, 'selva2_lejos.png')
    guardar(cerca, 'selva2_cerca.png')


if __name__ == '__main__':
    main()
