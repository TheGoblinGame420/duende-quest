# -*- coding: utf-8 -*-
"""
DUENDE QUEST — genera las capas de parallax de cada bioma.

El fondo del juego eran un degradado, unos triangulos planos y unas nubes
radiales. Funcionaba, pero es lo que hace que un juego se lea como "prototipo
de canvas" en vez de como un juego: no hay profundidad ni sensacion de lugar.

Genero dos capas por bioma con la paleta EXACTA que ya usa el motor (el array
BIOMES de js/engine.js), en vez de bajar un pack de internet que no pegue con
tus colores:
  · lejos: cordillera de siluetas, se mueve muy despacio
  · cerca: colinas y ruinas recortadas, se mueve mas rapido

Ambas son continuas en horizontal (el borde derecho encaja con el izquierdo),
asi que se pueden repetir en bucle sin costura. Se exportan en PNG de paleta,
que para siluetas planas pesa una decima parte que RGBA.

Uso:  python tools/generar_parallax.py
"""
import math
import os
import random

from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'assets', 'fondos')
ANCHO, ALTO = 800, 260

# Mismos colores que el array BIOMES del motor, para que las capas encajen con
# el degradado del cielo y con la linea de suelo de cada bioma.
BIOMAS = [
    ('noche',    (124, 58, 237), (10, 26, 15)),
    ('amanecer', (255, 80, 40),  (26, 10, 10)),
    ('selva',    (0, 200, 150),  (6, 20, 15)),
    ('tormenta', (192, 132, 252), (18, 10, 31)),
    ('desierto', (255, 180, 0),  (26, 20, 10)),
]


def perfil(rng, puntos, base, amplitud, rugosidad):
    """Perfil de altura continuo en los extremos (para repetir sin costura)."""
    # Suma de armonicos de frecuencia ENTERA: asi la onda cierra exactamente en
    # el borde y la capa se puede repetir en bucle sin costura. Nada de ruido
    # por punto: eso convertia la cordillera en una fila de puas.
    fases = [(rng.uniform(0, math.tau), rng.uniform(.7, 1.3)) for _ in range(5)]
    ys = []
    for i in range(puntos):
        t = i / float(puntos)
        h = 0.0
        for k, (fase, peso) in enumerate(fases, start=1):
            h += math.sin(t * math.tau * k + fase) * peso / (k * k)
        ys.append(base - amplitud * h)
    # Un suavizado final redondea los picos que queden angulosos.
    for _ in range(rugosidad):
        ys = [(ys[i - 1] + 2 * ys[i] + ys[(i + 1) % puntos]) / 4.0 for i in range(len(ys))]
    return ys


def capa(color, base, amplitud, rugosidad, alpha, semilla, ruinas=False):
    rng = random.Random(semilla)
    img = Image.new('RGBA', (ANCHO, ALTO), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    puntos = 220
    ys = perfil(rng, puntos, base, amplitud, rugosidad)
    poly = [(i * ANCHO / float(puntos - 1), ys[i]) for i in range(puntos)]
    poly += [(ANCHO, ALTO), (0, ALTO)]
    d.polygon(poly, fill=color + (alpha,))

    if ruinas:
        # Torres/ruinas recortadas sobre la silueta: dan escala y lectura de
        # "sitio", que es lo que un degradado nunca da.
        for _ in range(rng.randint(5, 8)):
            x = rng.randint(0, ANCHO - 40)
            w = rng.randint(14, 34)
            idx = min(puntos - 1, int(x / ANCHO * puntos))
            suelo = ys[idx]
            h = rng.randint(24, 70)
            d.rectangle([x, suelo - h, x + w, suelo + 6], fill=color + (alpha,))
            # ventanas encendidas, del color del bioma pero mas brillante
            luz = tuple(min(255, int(c * 1.5) + 40) for c in color)
            for fy in range(int(suelo - h) + 8, int(suelo) - 4, 12):
                for fx in range(x + 4, x + w - 4, 9):
                    if rng.random() < .45:
                        d.rectangle([fx, fy, fx + 3, fy + 4], fill=luz + (min(255, alpha + 70),))
    return img


def main():
    os.makedirs(SALIDA, exist_ok=True)
    total = 0
    for i, (nombre, acento, suelo) in enumerate(BIOMAS):
        lejos = capa(acento, ALTO * .58, 58, 2, 46, semilla=i * 7 + 1)
        cerca = capa(suelo, ALTO * .84, 26, 4, 210, semilla=i * 7 + 2, ruinas=True)
        for etiqueta, img in (('lejos', lejos), ('cerca', cerca)):
            ruta = os.path.join(SALIDA, '%s_%s.png' % (nombre, etiqueta))
            # Paleta de 64 colores: son siluetas planas, no fotos.
            img.quantize(colors=64, method=Image.FASTOCTREE).save(ruta, 'PNG', optimize=True)
            t = os.path.getsize(ruta)
            total += t
            print('  %-22s %5.1f KB' % (os.path.basename(ruta), t / 1024.0))
    print('\n  TOTAL parallax: %.1f KB (10 capas, 5 biomas)' % (total / 1024.0))


if __name__ == '__main__':
    print('Generando capas de parallax...\n')
    main()
