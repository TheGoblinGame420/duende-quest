# -*- coding: utf-8 -*-
"""DQ Iconos · de PNG a fuente.

Lee los PNG de 1024x1024 que deja rasterizar.mjs ("pixel oscuro = tinta"),
saca los contornos con precision subpixel, los simplifica y arma la fuente
TrueType "DQ Iconos" (WOFF2) con los puntos de codigo de mapa.json.

    python tools/iconos/fuente.py <dir_png> <mapa.json> <salida.woff2> <resumen.json>

Lo llama construir.mjs; no hace falta ejecutarlo a mano.
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from skimage import measure
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import newTable

UPM = 1024          # unidades por em
CAJA_Y = 870        # borde superior de la caja del icono (la caja va de -154 a 870)
REJILLA = 64        # los SVG se dibujan en 64x64: 1 unidad de rejilla = 16 unidades de fuente
LADO = 38           # aire a cada lado del icono: avance = ancho*16 + 76 (1100 con ancho 64)
ASC, DESC = 880, -144
TOL = 0.8           # Douglas-Peucker, en unidades de fuente
AREA_MIN = 40.0     # contornos mas chicos que esto (unidades^2) son ruido

def area(p):
    x, y = p[:, 0], p[:, 1]
    return 0.5 * float(np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y))

def contornos(png):
    """Devuelve (lista de poligonos en la rejilla de 1024 con y hacia abajo, metricas)."""
    im = np.asarray(Image.open(png).convert('L'), dtype=np.float64)
    if im.shape[0] != im.shape[1]:
        raise ValueError('el PNG no es cuadrado: ' + png)
    tam = im.shape[0]
    k = UPM / tam
    tinta = 1.0 - im / 255.0
    oscuro = tinta >= 0.5
    # Grises que no son borde: delatan degradados u opacidades (prohibidos en la guia).
    gris = float(np.mean((tinta > 0.2) & (tinta < 0.8)))
    ys, xs = np.nonzero(oscuro)
    met = {'tinta': round(100.0 * float(np.mean(oscuro)), 1), 'gris': round(100.0 * gris, 2)}
    if len(xs):
        u = REJILLA / tam
        met['caja'] = [round(float(xs.min()) * u, 1), round(float(ys.min()) * u, 1), round(float(xs.max() + 1) * u, 1), round(float(ys.max() + 1) * u, 1)]
    pad = 2
    campo = np.pad(tinta, pad, mode='constant', constant_values=0.0)
    pols = []
    for c in measure.find_contours(campo, 0.5):
        if len(c) < 4:
            continue
        c = measure.approximate_polygon(c, TOL / k)
        if len(c) < 4:
            continue
        c = c[:-1]                                   # cerrado: el ultimo repite al primero
        p = np.stack([(c[:, 1] - pad + 0.5) * k, (c[:, 0] - pad + 0.5) * k], axis=1)
        if abs(area(p)) < AREA_MIN:
            continue
        pols.append(p)
    return pols, met

def glifo(pols, dx):
    """Poligonos (y abajo, 0..1024) -> glifo TrueType colocado en la caja del icono."""
    fin = []
    for p in pols:
        q = np.stack([p[:, 0] + dx, CAJA_Y - p[:, 1]], axis=1)
        q = np.rint(q).astype(int)
        # quita puntos repetidos seguidos tras redondear
        keep = [i for i in range(len(q)) if tuple(q[i]) != tuple(q[i - 1])]
        q = q[keep]
        if len(q) >= 3:
            fin.append(q)
    # find_contours ya da sentido contrario a los huecos. TrueType quiere el exterior
    # en sentido horario (area negativa con y hacia arriba): si salio al reves, se invierte todo.
    if fin and sum(area(q.astype(float)) for q in fin) > 0:
        fin = [q[::-1] for q in fin]
    pen = TTGlyphPen(None)
    for q in fin:
        pen.moveTo((int(q[0][0]), int(q[0][1])))
        for x, y in q[1:]:
            pen.lineTo((int(x), int(y)))
        pen.closePath()
    return pen.glyph(), sum(len(q) for q in fin), len(fin)

def main():
    dir_png, ruta_mapa, salida, ruta_resumen = sys.argv[1:5]
    mapa = json.load(open(ruta_mapa, encoding='utf-8'))
    vacio = TTGlyphPen(None).glyph()
    orden = ['.notdef', 'vacio']
    glifos = {'.notdef': vacio, 'vacio': TTGlyphPen(None).glyph()}
    avances = {'.notdef': (UPM // 2, 0), 'vacio': (0, 0)}
    cmap = {0xFE0F: 'vacio', 0xFE0E: 'vacio', 0x200D: 'vacio'}
    uvs = []
    hechos, faltan, errores = [], [], []
    vistos = {}
    for g in mapa:
        nombre = g['nombre']
        cps = [int(c, 16) for c in g['cps']]
        for c in cps:
            if c in vistos:
                errores.append('U+%04X esta en dos glifos: %s y %s' % (c, vistos[c], nombre))
            vistos[c] = nombre
        png = os.path.join(dir_png, nombre + '.png')
        if not os.path.exists(png):
            faltan.append({'nombre': nombre, 'cps': g['cps'], 'lote': g.get('lote')})
            continue
        ancho = float(g.get('ancho', REJILLA))
        pols, met = contornos(png)
        if not pols:
            errores.append(nombre + ': el dibujo no tiene tinta')
            continue
        dx = LADO - (REJILLA - ancho) / 2.0 * (UPM / REJILLA)
        gl, npts, ncont = glifo(pols, dx)
        gn = 'i.' + nombre.replace('-', '_')
        orden.append(gn)
        glifos[gn] = gl
        avances[gn] = (int(round(ancho * UPM / REJILLA + 2 * LADO)), 0)
        for c in cps:
            cmap[c] = gn
            uvs.append((c, 0xFE0F, gn))
            uvs.append((c, 0xFE0E, gn))
        met.update({'nombre': nombre, 'cps': g['cps'], 'lote': g.get('lote'), 'puntos': npts, 'contornos': ncont})
        if met['gris'] > 1.5:
            errores.append('%s: %.1f%% de grises (¿degradado u opacidad?)' % (nombre, met['gris']))
        hechos.append(met)

    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(orden)
    fb.setupCharacterMap(cmap, uvs=uvs)
    fb.setupGlyf(glifos)
    for gn in orden:
        g = fb.font['glyf'][gn]
        xmin = getattr(g, 'xMin', 0) if g.numberOfContours else 0
        avances[gn] = (avances[gn][0], xmin)
    fb.setupHorizontalMetrics(avances)
    fb.setupHorizontalHeader(ascent=ASC, descent=DESC, lineGap=0)
    fb.setupNameTable({'familyName': 'DQ Iconos', 'styleName': 'Regular', 'uniqueFontIdentifier': 'DQ Iconos: Duende Quest', 'fullName': 'DQ Iconos', 'psName': 'DQIconos-Regular', 'version': 'Version 1.0'})
    fb.setupOS2(version=4, sTypoAscender=ASC, sTypoDescender=DESC, sTypoLineGap=0, usWinAscent=ASC, usWinDescent=160, sxHeight=512, sCapHeight=716, fsSelection=0x40 | 0x80, achVendID='DQ  ')
    fb.setupPost(keepGlyphNames=False)
    gasp = newTable('gasp')
    gasp.gaspRange = {0xFFFF: 0x000A}     # siempre suavizado en grises, sin ajuste a la rejilla
    fb.font['gasp'] = gasp
    es_woff2 = salida.lower().endswith('.woff2')
    fb.font.flavor = 'woff2' if es_woff2 else 'woff'
    os.makedirs(os.path.dirname(salida), exist_ok=True)
    fb.save(salida)

    peso = os.path.getsize(salida)
    resumen = {
        'fuente': os.path.basename(salida), 'bytes': peso, 'glifos': len(hechos),
        'puntosDeCodigo': sum(len(h['cps']) for h in hechos),
        'bytesPorGlifo': round(peso / max(1, len(hechos))),
        'hechos': hechos, 'faltan': faltan, 'errores': errores,
    }
    json.dump(resumen, open(ruta_resumen, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('fuente.py: %d glifos, %d bytes' % (len(hechos), peso))

if __name__ == '__main__':
    main()
