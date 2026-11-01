# -*- coding: utf-8 -*-
"""
DUENDE QUEST — recomprime los PNG pesados sin cambiar nombre ni tamano.

Para cada PNG prueba dos versiones y se queda con la mas liviana que pase el
control de calidad:
  1. el mismo PNG guardado con compresion maxima (sin perdida),
  2. paleta de 255 colores + 1 transparente (PNG de 8 bits con tRNS).
     La paleta sale de un k-means pesado sobre el color premultiplicado por el
     alfa (lo que se ve de verdad), asi los bordes suaves no se rompen como con
     el octree de Pillow. Sin difuminado: en pixel art solo mete ruido.

Control de calidad (pixel a pixel contra el original):
  - PSNR del color premultiplicado >= --psnr (34.5 dB: comparado a 4x zoom,
    las skins ricas en colores quedan iguales a la vista). La hoja animada del
    duende pide 42 dB porque teñir() (client.js y mundo.js) la gira de tono
    para cada skin y las bandas se notarian mas.
  - PSNR del alfa >= 40 dB y ningun pixel cambia su alfa mas de --alfa.
  - Lo transparente sigue transparente y lo visible sigue visible.
Si no ahorra mas del 15 %, el archivo se deja igual.

Requiere Pillow, numpy y scipy.
Uso:
  python tools/optimizar_png.py            -> solo mide e informa (simulacro)
  python tools/optimizar_png.py --escribir -> reemplaza los archivos
  python tools/optimizar_png.py --escribir assets/items   (otras rutas)
Ojo: /assets/ se cachea hasta 24 h; los jugadores ven el cambio al renovarse.
"""
import argparse
import glob
import io
import math
import os
import sys

import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Lo que se descarga antes de ocultar #carga (skins, enemigos, fondos, moneda, banner)
POR_DEFECTO = [
    'assets/skins',
    'assets/enemigos',
    'assets/fondos',
    'assets/ui/coin.png',
    'assets/mmo_banner.png',
]
# Exigencia extra para lo que se tiñe en el cliente
PSNR_ESTRICTO = {'duende_anim.png': 42.0}
AHORRO_MINIMO = 0.15
PESO_ALFA = 2.0  # el alfa pesa doble al elegir colores: cuida los bordes


def listar(rutas):
    salida = []
    for r in rutas:
        p = os.path.join(RAIZ, r)
        if os.path.isdir(p):
            salida += sorted(glob.glob(os.path.join(p, '**', '*.png'), recursive=True))
        elif p.lower().endswith('.png') and os.path.isfile(p):
            salida.append(p)
    return salida


def guardar(im, **kw):
    b = io.BytesIO()
    im.save(b, 'PNG', optimize=True, **kw)
    return b.getvalue()


def rgba(im):
    return np.asarray(im.convert('RGBA'), dtype=np.float64)


def psnr(a, b):
    mse = float(((a - b) ** 2).mean())
    return 99.0 if mse == 0 else 10 * math.log10(255 * 255 / mse)


def comparar(orig, nuevo):
    """(psnr_color_premultiplicado, psnr_alfa, max_dif_alfa, cambia_visibilidad)"""
    if orig.size != nuevo.size:
        return 0.0, 0.0, 255, True
    a, b = rgba(orig), rgba(nuevo)
    pa = a[..., :3] * (a[..., 3:] / 255)
    pb = b[..., :3] * (b[..., 3:] / 255)
    cambia = bool(((a[..., 3] > 0) != (b[..., 3] > 0)).any())
    return psnr(pa, pb), psnr(a[..., 3], b[..., 3]), int(np.abs(a[..., 3] - b[..., 3]).max()), cambia


def cuantizar(im, colores=256, iters=24, semilla=1):
    """PNG de 8 bits: indice 0 = transparente; el resto, k-means pesado."""
    a = np.ascontiguousarray(np.asarray(im.convert('RGBA'), dtype=np.uint8))
    h, w, _ = a.shape
    plano = a.reshape(-1, 4)
    vis = plano[:, 3] > 0
    claves = plano.view(np.uint32).ravel()
    uni, inv, cnt = np.unique(claves[vis], return_inverse=True, return_counts=True)
    if not len(uni):
        return None
    ucol = uni.view(np.uint8).reshape(-1, 4).astype(np.float64)
    X = np.hstack([ucol[:, :3] * (ucol[:, 3:4] / 255), ucol[:, 3:4] * PESO_ALFA])
    n = colores - 1
    if len(X) <= n:
        C = X.copy()
    else:
        rng = np.random.default_rng(semilla)
        # arranque k-means++ sobre una muestra pesada por frecuencia
        m = min(len(X), 20000)
        idx = rng.choice(len(X), m, replace=False, p=cnt / cnt.sum()) if len(X) > m else np.arange(len(X))
        S, Sw = X[idx], cnt[idx].astype(np.float64)
        C = [S[rng.choice(len(S), p=Sw / Sw.sum())]]
        d2 = ((S - C[0]) ** 2).sum(1)
        for _ in range(n - 1):
            pr = d2 * Sw
            c = S[rng.choice(len(S), p=pr / pr.sum())] if pr.sum() > 0 else S[rng.integers(len(S))]
            C.append(c)
            d2 = np.minimum(d2, ((S - c) ** 2).sum(1))
        C = np.array(C)
        for _ in range(iters):
            _, lab = cKDTree(C).query(X)
            peso = np.bincount(lab, cnt, n)
            for j in range(X.shape[1]):
                s = np.bincount(lab, cnt * X[:, j], n)
                C[:, j] = np.where(peso > 0, s / np.maximum(peso, 1e-9), C[:, j])
    _, lab = cKDTree(C).query(X)
    A = np.clip(np.round(C[:, 3] / PESO_ALFA), 1, 255)  # nunca 0: lo visible sigue visible
    RGB = np.clip(np.round(C[:, :3] / (A[:, None] / 255)), 0, 255)
    pal = np.vstack([[0, 0, 0, 0], np.hstack([RGB, A[:, None]])]).astype(np.uint8)
    ind = np.zeros(h * w, np.uint8)
    ind[vis] = (lab + 1)[inv].astype(np.uint8)
    q = Image.frombytes('P', (w, h), ind.tobytes())
    q.putpalette(pal[:, :3].ravel().tolist())
    alfas = bytes(pal[:, 3].tolist())
    return guardar(q, transparency=alfas) if (pal[:, 3] < 255).any() else guardar(q)


def procesar(ruta, args):
    original = open(ruta, 'rb').read()
    im = Image.open(io.BytesIO(original))
    im.load()
    rel = os.path.relpath(ruta, RAIZ).replace('\\', '/')
    limite = PSNR_ESTRICTO.get(os.path.basename(ruta), args.psnr)
    cands = [('sin perdida', guardar(im))]
    if im.mode not in ('P', 'L', '1'):  # lo que ya es de 8 bits solo se recomprime
        q = cuantizar(im)
        if q:
            cands.append(('8 bits', q))
    mejor = None
    for nombre, datos in cands:
        if len(datos) >= len(original) or (mejor and len(datos) >= len(mejor[1])):
            continue
        nuevo = Image.open(io.BytesIO(datos))
        nuevo.load()
        pc, pa, da, cambia = comparar(im, nuevo)
        if nuevo.size != im.size or cambia:
            continue
        if nombre != 'sin perdida' and (pc < limite or pa < 40 or da > args.alfa):
            if args.detalle:
                print(f'    descartado {nombre} {rel}: color {pc:.1f} dB, alfa {pa:.1f} dB, max {da}')
            continue
        mejor = (nombre, datos, pc)
    if not mejor or len(mejor[1]) > len(original) * (1 - AHORRO_MINIMO):
        print(f'  igual      {rel}  {len(original) // 1024} KB')
        return len(original), len(original)
    nombre, datos, pc = mejor
    print(f'  {"ESCRITO" if args.escribir else "ahorraria"}  {rel}  {len(original) // 1024} -> {len(datos) // 1024} KB'
          f'  (-{100 - 100 * len(datos) // len(original)} %, {nombre}, {pc:.1f} dB)')
    if args.escribir:
        with open(ruta, 'wb') as f:
            f.write(datos)
    return len(original), len(datos)


def main():
    ap = argparse.ArgumentParser(description='Recomprime PNG del juego sin cambiar nombre ni tamano.')
    ap.add_argument('rutas', nargs='*', default=POR_DEFECTO)
    ap.add_argument('--escribir', action='store_true', help='reemplaza los archivos (si no, solo informa)')
    ap.add_argument('--psnr', type=float, default=34.5, help='calidad minima del color en dB')
    ap.add_argument('--alfa', type=int, default=48, help='cambio maximo del alfa en un pixel')
    ap.add_argument('--detalle', action='store_true', help='explica por que se descarta cada 8 bits')
    args = ap.parse_args()
    archivos = listar(args.rutas)
    if not archivos:
        sys.exit('No hay PNG en esas rutas.')
    antes = despues = 0
    for r in archivos:
        a, d = procesar(r, args)
        antes += a
        despues += d
    print(f'Total: {antes // 1024} KB -> {despues // 1024} KB (-{100 - 100 * despues // max(1, antes)} %)')


if __name__ == '__main__':
    main()
