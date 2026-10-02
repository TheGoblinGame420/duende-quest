# -*- coding: utf-8 -*-
"""
DUENDE QUEST ONLINE — gran expansion (zonas Nv 40-60).

Genera, desde los packs de recursos/ (todos de ansimuz o Ashuuya, CC0 o
CC-BY 3.0 — ver CREDITOS.md):
  - las hojas de animacion de los monstruos nuevos en assets/enemigos/sheets/
    con el formato de HOJAS (mmo/js/data.js): fila 0 = moverse, fila 1 =
    [golpe x2, muerte x1]. Ningun pack trae golpe/muerte propios, asi que se
    reusan los dos ultimos frames del ciclo (mismo truco que el resto del
    bestiario, ver tools/generar_fantasma_cc0.py).
  - los fondos parallax <zona>_lejos.png / <zona>_cerca.png en assets/fondos/.

Cada hoja se recorta al bbox comun de todos sus frames: asi el borde de
abajo de la celda son los pies y el monstruo no flota sobre el suelo.

Al final imprime las lineas de HOJAS para pegar en data.js.

Uso:  python tools/generar_mmo_expansion_cc0.py
"""
import os

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REC = os.path.join(RAIZ, 'recursos')
SHEETS = os.path.join(RAIZ, 'assets', 'enemigos', 'sheets')
FONDOS = os.path.join(RAIZ, 'assets', 'fondos')


def archivos(carpeta, nombres):
    return [Image.open(os.path.join(REC, carpeta, n)).convert('RGBA') for n in nombres]


def tira(ruta, ancho_celda, n, x0s=None):
    im = Image.open(os.path.join(REC, ruta)).convert('RGBA')
    if x0s:
        return [im.crop((x, 0, x + ancho_celda, im.size[1])) for x in x0s]
    return [im.crop((i * ancho_celda, 0, (i + 1) * ancho_celda, im.size[1])) for i in range(n)]


# clave -> frames del ciclo de movimiento
FUENTES = {
    # Cumbres del Ocaso (Nv 40-45)
    'murcielago': lambda: tira('enemigos/ashuuya-platformer-enemies/plat_bat_spritesheet.png', 127, 3),
    'arana': lambda: archivos('mapas/ansimuz-gothicvania-swamp/Sprites/Spider/walk', [f'spider{i}.png' for i in range(1, 5)]),
    'hellgato': lambda: archivos('mapas/ansimuz-gothicvania-cemetery/PNG/Sprites/hell-gato', [f'hell-gato-{i}.png' for i in range(1, 5)]),
    'esqueleto_capa': lambda: archivos('mapas/ansimuz-gothicvania-cemetery/PNG/Sprites/skeleton-clothed', [f'skeleton-clothed-{i}.png' for i in range(1, 9)]),
    'coloso': lambda: tira('enemigos/ashuuya-platformer-enemies/plat_skeleton_spritesheet.png', 138, 4),
    # Cavernas Abisales (Nv 45-50)
    'cangrejo': lambda: tira('mapas/ansimuz-warped-caves/PNG/spritesheets/enemies/crab-walk.png', 48, 4),
    'saltador': lambda: tira('mapas/ansimuz-warped-caves/PNG/spritesheets/enemies/jumper-idle.png', 47, 4)
        + tira('mapas/ansimuz-warped-caves/PNG/spritesheets/enemies/jumper-jump.png', 47, 1),
    'pulpo': lambda: tira('mapas/ansimuz-warped-caves/PNG/spritesheets/enemies/octopus.png', 28, 4),
    'cosa': lambda: archivos('mapas/ansimuz-gothicvania-swamp/Sprites/Thing/walk thing', [f'thing{i}.png' for i in range(1, 5)]),
    # Abismo Marino (Nv 50-55)
    'pez': lambda: tira('mapas/ansimuz-underwater/PNG/enemies/fish.png', 32, 4),
    'pez_dardo': lambda: tira('mapas/ansimuz-underwater/PNG/enemies/fish-dart.png', 39, 4, [0, 40, 78, 120]),
    'pez_grande': lambda: tira('mapas/ansimuz-underwater/PNG/enemies/fish-big.png', 54, 4),
    'espectro': lambda: archivos('mapas/ansimuz-gothicvania-swamp/Sprites/Ghost/Flying', [f'Ghost{i}.png' for i in range(1, 5)]),
    'baba': lambda: tira('enemigos/ashuuya-platformer-enemies/plat_slime_spritesheet.png', 74, 4),
    # Acantilados Magicos (Nv 55-60)
    'aguila': lambda: archivos('mapas/ansimuz-sunny-land/PNG/sprites/eagle', [f'eagle-attack-{i}.png' for i in range(1, 5)]),
    'zarigueya': lambda: archivos('mapas/ansimuz-sunny-land/PNG/sprites/opossum', [f'opossum-{i}.png' for i in range(1, 7)]),
    'fantasma_halo': lambda: archivos('mapas/ansimuz-gothicvania-cemetery/PNG/Sprites/ghost-halo', [f'ghost-halo-{i}.png' for i in range(1, 5)]),
    'dragon': lambda: tira('enemigos/ansimuz-sideview-fantasy/sunny-dragon/PNG/spritesheets/sunny-dragon-fly.png', 192, 9),
}


def hoja(clave, frames):
    # Todas las celdas al mismo tamaño (alineadas abajo y al centro)
    W = max(f.size[0] for f in frames)
    H = max(f.size[1] for f in frames)
    norm = []
    for f in frames:
        c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        c.paste(f, ((W - f.size[0]) // 2, H - f.size[1]))
        norm.append(c)
    # bbox comun -> recorte
    x0, y0, x1, y1 = W, H, 0, 0
    for f in norm:
        b = f.split()[-1].getbbox()
        if b:
            x0, y0, x1, y1 = min(x0, b[0]), min(y0, b[1]), max(x1, b[2]), max(y1, b[3])
    norm = [f.crop((x0, y0, x1, y1)) for f in norm]
    fw, fh = x1 - x0, y1 - y0
    n = len(norm)
    golpe = [norm[-2], norm[-1]] if n >= 2 else [norm[0], norm[0]]
    cols = max(n, 3)
    out = Image.new('RGBA', (fw * cols, fh * 2), (0, 0, 0, 0))
    for i, f in enumerate(norm):
        out.paste(f, (i * fw, 0))
    for i, f in enumerate(golpe + [norm[-1]]):
        out.paste(f, (i * fw, fh))
    out.save(os.path.join(SHEETS, clave + '.png'), optimize=True)
    return f"  {clave + ':':<18} {{ fw: {fw}, fh: {fh}, ideal: {fh}, mov: [0, 0, {n}], golpe: [1, 0, 2], muerte: [2, 1] }},"


def repetir_x(im, ancho):
    out = Image.new('RGBA', (ancho, im.size[1]), (0, 0, 0, 0))
    for x in range(0, ancho, im.size[0]):
        out.paste(im, (x, 0))
    return out


def capa(ruta):
    return Image.open(os.path.join(REC, ruta)).convert('RGBA')


def fondos():
    md = 'mapas/ansimuz-mountain-dusk/layers/'
    # Cumbres: cielo con luna + montañas lejanas + cordillera, todo en una capa
    lejos = repetir_x(capa(md + 'parallax-mountain-bg.png'), 544)
    lejos.alpha_composite(repetir_x(capa(md + 'parallax-mountain-montain-far.png'), 544))
    lejos.alpha_composite(capa(md + 'parallax-mountain-mountains.png'))
    lejos.save(os.path.join(FONDOS, 'cumbres_lejos.png'), optimize=True)
    cerca = capa(md + 'parallax-mountain-trees.png').copy()
    cerca.alpha_composite(capa(md + 'parallax-mountain-foreground-trees.png'))
    cerca.save(os.path.join(FONDOS, 'cumbres_cerca.png'), optimize=True)

    wc = 'mapas/ansimuz-warped-caves/PNG/environment/layers/'
    capa(wc + 'background.png').save(os.path.join(FONDOS, 'cavernas_lejos.png'), optimize=True)
    capa(wc + 'middleground.png').save(os.path.join(FONDOS, 'cavernas_cerca.png'), optimize=True)

    uw = 'mapas/ansimuz-underwater/PNG/environment/'
    capa(uw + 'background.png').save(os.path.join(FONDOS, 'abismo_lejos.png'), optimize=True)
    mid = capa(uw + 'midground.png')
    # La capa media mide 960x512: solo la mitad de abajo (las rocas del fondo
    # marino); la de arriba taparia todo el cielo del mapa.
    mid.crop((0, 256, 960, 512)).save(os.path.join(FONDOS, 'abismo_cerca.png'), optimize=True)

    mc = 'mapas/ansimuz-magic-cliffs/PNG/'
    nubes = capa(mc + 'clouds.png')
    cielo = repetir_x(capa(mc + 'sky.png'), nubes.size[0]).resize((nubes.size[0], nubes.size[1]))
    cielo.alpha_composite(nubes)
    cielo.save(os.path.join(FONDOS, 'acantilados_lejos.png'), optimize=True)
    capa(mc + 'far-grounds.png').save(os.path.join(FONDOS, 'acantilados_cerca.png'), optimize=True)


def main():
    os.makedirs(SHEETS, exist_ok=True)
    for clave, f in FUENTES.items():
        print(hoja(clave, f()))
    fondos()


if __name__ == '__main__':
    main()
