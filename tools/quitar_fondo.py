# -*- coding: utf-8 -*-
"""
DUENDE QUEST — recorta el fondo falso de los sprites.

Ocho assets del juego NO tienen transparencia: el generador de IA les pinto el
tablero de ajedrez gris DENTRO de la imagen y el alfa esta a 255 en todo el
lienzo. En el juego eso se ve como un rectangulo gris alrededor del dibujo.

Ese es justo el motivo por el que el motor dibujaba todo con
globalCompositeOperation='screen': era un parche para que el gris opaco no se
notara, a costa de borrar el contorno negro de TODOS los demas sprites (que si
tienen alfa correcto). Arreglando el fondo de verdad ya no hace falta el parche.

Metodo: relleno por difusion desde el borde. Se toman los tonos dominantes del
borde (el tablero son dos grises alternos), y se propaga desde fuera hacia
dentro marcando como fondo todo pixel gris parecido a esos tonos. Al ser una
difusion desde el borde y no un umbral global, las zonas claras del INTERIOR
del dibujo (el blanco de la espada de hielo, por ejemplo) se conservan.

Uso:  python tools/quitar_fondo.py [--dry]
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRY = '--dry' in sys.argv

# Assets con el fondo pintado. El resto ya tiene alfa correcto y no se tocan.
CON_FONDO_FALSO = [
    'cofres/cofre_comun.png',
    'cofres/cofre_epico.png',
    'cofres/cofrelegendario.png',
    'skins/skin_legendariafull.png',
    'skins/skin_necromancer.png',
    'skins/duende_comun.png',
    'enemigos/enemy_magmar.png',
    'armas/katana_spark_item.png',
    'armas/katana_comun_item.png',
    'sprite_sheets/sprite_sheet_duende_hero.png',
]

# El tablero son DOS tonos concretos y planos. Con una tolerancia amplia el
# relleno se filtraba por las partes grises del propio dibujo (las bandas
# metalicas del cofre, por ejemplo) y se las comia. Con tolerancia estrecha
# solo cae el tablero.
TOLERANCIA = 20      # cuanto puede desviarse un pixel del tono de fondo
GRISEO = 22         # diferencia maxima entre canales para considerarlo gris


def quitar_fondo(ruta_abs):
    img = Image.open(ruta_abs).convert('RGBA')
    arr = np.array(img)
    rgb = arr[:, :, :3].astype(np.int16)
    h, w = rgb.shape[:2]

    # ¿Es gris? El tablero y el fondo blanco lo son; el arte tiene color.
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    gris = (mx - mn) <= GRISEO

    # Tonos dominantes del borde: ahi seguro que es fondo.
    borde = np.concatenate([
        rgb[0, :, :].reshape(-1, 3), rgb[-1, :, :].reshape(-1, 3),
        rgb[:, 0, :].reshape(-1, 3), rgb[:, -1, :].reshape(-1, 3),
    ])
    # Nos quedamos con los dos tonos del tablero: el mas frecuente del borde y
    # el mas frecuente que este claramente separado de el (el tablero alterna
    # dos grises). Coger "los 4 mas frecuentes" acababa cubriendo una franja
    # continua de luminancias y el relleno se escapaba hacia el dibujo.
    lum_borde = borde.mean(axis=1).astype(np.int16)
    frec = sorted(((int(t), int((lum_borde == t).sum())) for t in np.unique(lum_borde)),
                  key=lambda kv: -kv[1])
    tonos = [frec[0][0]]
    for t, _ in frec[1:]:
        if all(abs(t - u) > TOLERANCIA * 2 for u in tonos):
            tonos.append(t)
        if len(tonos) == 2:
            break

    # Todo el rango entre los dos tonos del tablero cuenta como fondo: en la
    # frontera entre una casilla clara y una oscura hay pixeles intermedios por
    # el suavizado, y si se dejan fuera parten el fondo en casillas sueltas que
    # ya no conectan con el borde (por eso antes solo se borraba un tercio).
    lum = rgb.mean(axis=2)
    cerca = (lum >= min(tonos) - TOLERANCIA) & (lum <= max(tonos) + TOLERANCIA)
    candidato = gris & cerca

    # Difusion desde el borde: solo se borra lo que esta CONECTADO al exterior,
    # asi que las zonas claras encerradas dentro del dibujo (el blanco de la
    # espada de hielo) se conservan. La dilatacion previa solo sirve para
    # puentear huecos de 1-2 px; el resultado se vuelve a cruzar con los
    # pixeles que de verdad tenian tono de fondo.
    puente = ndimage.binary_dilation(candidato, iterations=2)
    etiquetas, _ = ndimage.label(puente)
    del_borde = set(etiquetas[0, :].tolist()) | set(etiquetas[-1, :].tolist()) \
        | set(etiquetas[:, 0].tolist()) | set(etiquetas[:, -1].tolist())
    del_borde.discard(0)
    fondo = np.isin(etiquetas, list(del_borde)) & candidato

    alpha = arr[:, :, 3].copy()
    alpha[fondo] = 0

    # Segunda pasada: algunos assets (los cofres) llevan ademas un degradado
    # gris pintado alrededor del dibujo. Al ser un degradado, su luminancia se
    # sale del rango del tablero y el relleno anterior no lo alcanza. Aqui se
    # limpia por SATURACION: el arte del cofre es oro y madera, muy saturado;
    # el halo es gris. Solo se toca lo que conecta con el fondo ya borrado.
    sat = (mx - mn)
    grisaceo = sat <= 40
    alcanzable = ndimage.binary_dilation(fondo | grisaceo, iterations=1)
    etq2, _ = ndimage.label(alcanzable)
    tocan = set(etq2[fondo].tolist())
    tocan.discard(0)
    halo_ext = np.isin(etq2, list(tocan)) & grisaceo & ~fondo
    # Se desvanece en proporcion a lo gris que sea: los pixeles de transicion
    # conservan algo de opacidad y el contorno no queda dentado.
    # Por debajo de 26 de saturacion es halo puro y se va del todo; entre 26 y
    # 40 se desvanece progresivamente para que el contorno no quede dentado.
    factor = np.clip((sat[halo_ext] - 26) / 14.0, 0, 1)
    alpha[halo_ext] = (alpha[halo_ext] * factor).astype(alpha.dtype)

    arr[:, :, 3] = alpha
    img = Image.fromarray(arr, 'RGBA')

    pct = 100.0 * fondo.sum() / (h * w)
    caja = img.getbbox()
    return img, pct, caja


def main():
    print('Quitando el fondo pintado%s...\n' % (' (simulacion)' if DRY else ''))
    for rel in CON_FONDO_FALSO:
        ruta = os.path.join(RAIZ, 'assets', rel.replace('/', os.sep))
        if not os.path.exists(ruta):
            print('  FALTA %s' % rel)
            continue
        img, pct, caja = quitar_fondo(ruta)
        if not DRY:
            img.save(ruta, 'PNG', optimize=True)
        print('  %-48s fondo borrado: %5.1f%%   caja util: %s' % (rel, pct, caja))


if __name__ == '__main__':
    main()
