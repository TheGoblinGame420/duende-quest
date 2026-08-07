# -*- coding: utf-8 -*-
"""
DUENDE QUEST — extrae los fotogramas del sprite sheet del duende.

En tools/fuentes/ hay una hoja completa de animacion del mismo goblin
que sale en skin_hero.png: IDLE x4, WALK x6, ATTACK x5, HIT x3, DEATH x6 y
GATHERING x4. Nadie la cargaba: el jugador era una imagen congelada, y de
hecho el motor calculaba PL.animTimer y PL.runFrame sin leerlos nunca.

La hoja no es una rejilla regular: cada fotograma vive dentro de una caja con
borde negro sobre fondo blanco, con titulos de seccion. Este script:
  1. detecta las cajas por sus bordes rectos,
  2. descarta las que son demasiado pequenas (los titulos y los iconos sueltos),
  3. recorta el interior, quita el blanco por difusion desde el borde,
  4. recorta al dibujo y normaliza todos los fotogramas a la misma altura,
  5. los agrupa por bandas horizontales (cada fila de la hoja es una animacion),
  6. y escribe un atlas PNG en tira mas un JSON con los indices.

Uso:  python tools/extraer_animacion.py
"""
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# La hoja original vive fuera de assets/: es material de origen para esta
# herramienta, no algo que el jugador deba descargar (pesa 5,7 MB).
HOJA = os.path.join(RAIZ, 'tools', 'fuentes', 'sprite_sheet_duende_hero.png')
SALIDA_PNG = os.path.join(RAIZ, 'assets', 'skins', 'duende_anim.png')
SALIDA_JSON = os.path.join(RAIZ, 'assets', 'skins', 'duende_anim.json')

ALTO_FOTOGRAMA = 140     # altura normalizada de cada fotograma del atlas
MIN_LADO = 120           # por debajo de esto es un titulo o un icono, no un fotograma


def cajas_de_la_hoja(gris):
    """Devuelve las cajas interiores delimitadas por los bordes negros.

    Buscar las lineas del borde por "columnas con muchos pixeles oscuros" no
    funciona: una columna que atraviesa un personaje tambien tiene muchos
    pixeles oscuros, asi que se troceaba la hoja entera. En cambio el interior
    de cada caja es una region BLANCA cerrada por el borde negro y separada del
    blanco de la pagina, asi que basta con etiquetar el blanco y quedarse con
    las regiones grandes que NO tocan el borde de la imagen.
    """
    blanco = gris > 215
    etq, _ = ndimage.label(blanco)

    del_borde = set(etq[0, :].tolist()) | set(etq[-1, :].tolist()) \
        | set(etq[:, 0].tolist()) | set(etq[:, -1].tolist())
    del_borde.discard(0)

    cajas = []
    for idx, sl in enumerate(ndimage.find_objects(etq), start=1):
        if sl is None or idx in del_borde:
            continue
        ys, xs = sl
        alto, ancho = ys.stop - ys.start, xs.stop - xs.start
        if alto >= MIN_LADO and ancho >= MIN_LADO:
            cajas.append((xs.start, ys.start, xs.stop, ys.stop))
    return cajas


def limpiar(recorte):
    """Quita el fondo blanco por difusion desde el borde y recorta al dibujo."""
    arr = np.array(recorte.convert('RGBA'))
    rgb = arr[:, :, :3].astype(np.int16)
    lum = rgb.mean(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    claro = (lum > 215) & (sat < 30)

    etq, _ = ndimage.label(ndimage.binary_dilation(claro, iterations=1))
    borde = set(etq[0, :].tolist()) | set(etq[-1, :].tolist()) \
        | set(etq[:, 0].tolist()) | set(etq[:, -1].tolist())
    borde.discard(0)
    fondo = np.isin(etq, list(borde)) & claro

    arr[:, :, 3] = np.where(fondo, 0, arr[:, :, 3])
    img = Image.fromarray(arr, 'RGBA')
    caja = img.getbbox()
    return img.crop(caja) if caja else None


def agrupar_en_filas(cajas):
    """Reconstruye las cajas reales a partir de los fragmentos detectados.

    El personaje parte en varios trozos el blanco interior de su caja, asi que
    la deteccion devuelve fragmentos. Se agrupan por fila de la hoja y, dentro
    de cada fila, se fusionan los fragmentos que comparten franja horizontal.
    """
    cajas.sort(key=lambda c: c[1])
    filas = []
    for c in cajas:
        for f in filas:
            if c[1] - f['y0'] < 260:      # misma fila de la hoja
                f['items'].append(c)
                break
        else:
            filas.append({'y0': c[1], 'items': [c]})

    salida = []
    for f in filas:
        f['items'].sort(key=lambda c: c[0])
        fusionadas = []
        for (x0, y0, x1, y1) in f['items']:
            if fusionadas:
                px0, py0, px1, py1 = fusionadas[-1]
                solape = min(px1, x1) - max(px0, x0)
                if solape > 0.5 * min(px1 - px0, x1 - x0):
                    fusionadas[-1] = (min(px0, x0), min(py0, y0), max(px1, x1), max(py1, y1))
                    continue
            fusionadas.append((x0, y0, x1, y1))
        salida.append((f['y0'], fusionadas))
    return salida


def main():
    hoja = Image.open(HOJA).convert('RGBA')
    gris = np.array(hoja.convert('L'))
    cajas = cajas_de_la_hoja(gris)
    print('  fragmentos detectados: %d' % len(cajas))

    filas = agrupar_en_filas(cajas)

    # Primera pasada: recortar cada fotograma a su dibujo, sin escalar todavia.
    crudos = []
    grupos = []
    for y0, items in filas:
        inicio = len(crudos)
        for (x0, fy0, x1, y1) in items:
            limpio = limpiar(hoja.crop((x0 + 4, fy0 + 4, x1 - 4, y1 - 4)))
            if limpio is None or limpio.height < 60 or limpio.width < 30:
                continue
            crudos.append(limpio)
        if len(crudos) > inicio:
            grupos.append((inicio, len(crudos) - inicio, y0))

    if not crudos:
        print('  no se detecto ningun fotograma')
        return

    # Escala UNICA para todos: si cada fotograma se normaliza por su cuenta, el
    # duende tumbado de la animacion de muerte acaba tan alto como el de pie y
    # la animacion pega saltos. Con una sola escala y los pies alineados abajo,
    # el personaje mantiene su tamano en todos los fotogramas.
    alto_max = max(f.height for f in crudos)
    escala = ALTO_FOTOGRAMA / float(alto_max)
    escalados = [f.resize((max(1, int(round(f.width * escala))),
                           max(1, int(round(f.height * escala)))), Image.LANCZOS)
                 for f in crudos]

    ancho_celda = max(f.width for f in escalados)
    atlas = Image.new('RGBA', (ancho_celda * len(escalados), ALTO_FOTOGRAMA), (0, 0, 0, 0))
    for i, f in enumerate(escalados):
        atlas.paste(f, (i * ancho_celda + (ancho_celda - f.width) // 2,
                        ALTO_FOTOGRAMA - f.height), f)
    atlas.save(SALIDA_PNG, 'PNG', optimize=True)

    # Altura del personaje DE PIE dentro de la celda. La celda es mas alta que
    # el duende erguido (la reserva la ocupan los fotogramas de muerte, en los
    # que aparece tumbado), asi que el motor necesita este dato para que el
    # duende animado se vea del mismo tamano que el sprite estatico.
    fila_de_pie = grupos[0][1] if grupos else len(escalados)
    alto_pie = max(f.height for f in escalados[:fila_de_pie]) if fila_de_pie else ALTO_FOTOGRAMA

    meta = {
        'celda': [ancho_celda, ALTO_FOTOGRAMA],
        'total': len(escalados),
        'altoDePie': round(alto_pie / float(ALTO_FOTOGRAMA), 4),
        'grupos': [{'desde': g[0], 'n': g[1], 'y': int(g[2])} for g in grupos],
    }
    with open(SALIDA_JSON, 'w') as f:
        json.dump(meta, f, indent=1)

    print('  fotogramas: %d  celda %dx%d  atlas %.0f KB'
          % (len(escalados), ancho_celda, ALTO_FOTOGRAMA,
             os.path.getsize(SALIDA_PNG) / 1024.0))
    for g in meta['grupos']:
        print('    fila y=%-5d desde %2d, %d fotogramas' % (g['y'], g['desde'], g['n']))


if __name__ == '__main__':
    print('Extrayendo la animacion del duende...')
    main()
