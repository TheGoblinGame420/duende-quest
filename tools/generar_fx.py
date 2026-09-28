# -*- coding: utf-8 -*-
"""
DUENDE QUEST — tiras de efectos (FX) a partir del pack CC0 de ansimuz.

Fuente: recursos/enemigos/ansimuz-sideview-fantasy/Grotto-escape-2-FX
(Sideview Fantasy Collection, ansimuz, CC0 — ver CREDITOS.md).

Cada efecto viene como una carpeta de PNG sueltos. El motor los quiere como
una sola tira horizontal (menos peticiones y un solo drawImage con recorte),
asi que este script los une y los guarda en assets/fx/ a su tamaño nativo:
el motor los escala con imageSmoothingEnabled = false, que conserva el pixel.

Uso:  python tools/generar_fx.py
"""
import glob
import os

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN = os.path.join(RAIZ, 'recursos', 'enemigos', 'ansimuz-sideview-fantasy',
                      'Grotto-escape-2-FX', 'PNG', 'sprites')
DESTINO = os.path.join(RAIZ, 'assets', 'fx')

# nombre en el juego -> carpeta del pack
EFECTOS = {
    'corte_h': 'slash-horizontal',
    'corte_arriba': 'slash-upward',
    'corte_giro': 'slash-circular',
    'muerte': 'enemy-death',
    'rayo': 'electro-shock',
}


def main():
    for nombre, carpeta in EFECTOS.items():
        frames = [Image.open(f).convert('RGBA') for f in sorted(glob.glob(os.path.join(ORIGEN, carpeta, '*.png')))]
        w, h = frames[0].size
        tira = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
        for i, f in enumerate(frames):
            tira.alpha_composite(f, (i * w, 0))
        # Paleta de 64 colores con alfa: el pixel art de origen tiene menos,
        # asi que no se pierde nada y el archivo pesa una fraccion.
        tira = tira.quantize(colors=64, method=Image.Quantize.FASTOCTREE)
        ruta = os.path.join(DESTINO, nombre + '.png')
        tira.save(ruta, optimize=True)
        print(f'{nombre:13s} {len(frames)} frames de {w}x{h} -> {os.path.getsize(ruta)} bytes')


if __name__ == '__main__':
    main()
