# Chicha Wars: recorta las laminas del dueño (fondo gris liso) en sprites PNG transparentes.
#   python tools/cw_recortar.py            (lee assets/chicha-wars/originales, escribe assets/chicha-wars/*.png)
# Fondo: relleno desde los bordes por pixeles grises (fondo y sombras). Cada pieza es un componente grande;
# los brillos chicos se pegan a la pieza mas cercana; los rotulos «LVL n» (bajo cada olla) se descartan.
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

RAIZ = os.path.join(os.path.dirname(__file__), '..', 'assets', 'chicha-wars')
ORIG = os.path.join(RAIZ, 'originales')
LAMINAS = {
    'cucharones': ['cucharon_1', 'cucharon_2', 'cucharon_3', 'cucharon_4', 'cucharon_5'],
    'tablas': ['tabla_1', 'tabla_2', 'tabla_3', 'tabla_4', 'tabla_5'],
    'exprimidores': ['exprimidor_1', 'exprimidor_2', 'exprimidor_3', 'exprimidor_4', 'exprimidor_5'],
    'vasos': ['vaso_1', 'vaso_2', 'vaso_3', 'vaso_4', 'vaso_5'],
    'jarras': ['jarra_1', 'jarra_2', 'jarra_3', 'jarra_4', 'jarra_5', 'jarra_6'],
    'coladores': ['colador_1', 'colador_2', 'colador_3', 'colador_4', 'colador_5'],
    'personas': ['chichera_maestra', 'agricultor', 'aventurero', 'ayudante', 'casera', 'alquimista'],
    'iconos': ['ico_fogata', 'ico_reloj', 'ico_pergamino', 'ico_ingredientes', 'ico_monedas', 'ico_magia'],
    'ollas': ['olla_1', 'olla_2', 'olla_3', 'olla_4', 'olla_5', 'olla_6'],
    'ingredientes': ['ing_maiz', 'ing_pina', 'ing_manzana', 'ing_canela', 'ing_limon', 'ing_azucar'],
}
LADO = {'personas': 560, 'ollas': 420}

def mascara_fondo(a):
    h, w, _ = a.shape
    borde = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(borde, axis=0)
    mx, mn = a.max(axis=2), a.min(axis=2)
    gris = (mx - mn) < 16
    v = a.mean(axis=2)
    candidato = gris & (v > 36) & (v < bg.mean() + 14)
    etiq, n = ndimage.label(candidato)
    ids = set(np.unique(np.concatenate([etiq[0], etiq[-1], etiq[:, 0], etiq[:, -1]]))) - {0}
    fondo = np.isin(etiq, list(ids))
    # Huecos de fondo encerrados (entre el asa y la jarra): grandes y casi del color exacto del fondo.
    cerca = gris & (np.abs(v - bg.mean()) < 6)
    et2, n2 = ndimage.label(cerca)
    tam = ndimage.sum(np.ones_like(v), et2, range(1, n2 + 1))
    for i, t in enumerate(tam, 1):
        if t > 900: fondo |= et2 == i
    return fondo, bg

def recortar(nombre, salidas):
    im = Image.open(os.path.join(ORIG, 'lamina_' + nombre + '.jpg')).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    fondo, bg = mascara_fondo(a)
    if nombre == 'ollas':   # franjas de los rotulos «LVL n» (bajo cada fila de ollas)
        h = a.shape[0]
        for y0, y1 in [(0.418, 0.48), (0.925, 1.0)]: fondo[int(h * y0):int(h * y1)] = True
    fg = ~fondo
    fg = ndimage.binary_opening(fg, iterations=1)
    etiq, n = ndimage.label(fg, structure=np.ones((3, 3)))
    objs = ndimage.find_objects(etiq)
    tam = ndimage.sum(np.ones(fg.shape), etiq, range(1, n + 1))
    grandes = [i for i in range(n) if tam[i] > 6000]
    grandes.sort(key=lambda i: -tam[i])
    # Todas las laminas son de dos filas: arriba / abajo por el centro de cada pieza; luego de izquierda a derecha.
    grandes = sorted(grandes[:len(salidas)], key=lambda i: (int((objs[i][0].start + objs[i][0].stop) / 2 > a.shape[0] / 2), (objs[i][1].start + objs[i][1].stop) / 2))
    if len(grandes) < len(salidas):
        print('  !', nombre, 'solo', len(grandes), 'piezas'); return {}
    asign = {i: [i] for i in grandes}
    for i in range(n):
        if i in asign or tam[i] < 12: continue
        sy, sx = objs[i]
        cy, cx = (sy.start + sy.stop) / 2, (sx.start + sx.stop) / 2
        mejor, md = None, 1e9
        for g in grandes:
            gy, gx = objs[g]
            dy = max(gy.start - cy, 0, cy - gy.stop); dx = max(gx.start - cx, 0, cx - gx.stop)
            d = (dx * dx + dy * dy) ** 0.5
            if d < md: md, mejor = d, g
        if md > 70: continue
        gy, gx = objs[mejor]
        # rotulo bajo la pieza (LVL n): ancho, bajo y por debajo de ella
        if nombre == 'ollas' and (sx.stop - sx.start) > 45 and (sy.stop - sy.start) < 48: continue   # rotulo «LVL n»
        asign[mejor].append(i)
    hechos = {}
    for k, g in enumerate(grandes):
        m = np.isin(etiq, [x + 1 for x in asign[g]])
        ys, xs = np.where(m)
        y0, y1, x0, x1 = max(0, ys.min() - 6), min(a.shape[0], ys.max() + 7), max(0, xs.min() - 6), min(a.shape[1], xs.max() + 7)
        alfa = Image.fromarray((m[y0:y1, x0:x1] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
        pieza = im.crop((x0, y0, x1, y1)).convert('RGBA'); pieza.putalpha(alfa)
        lado = LADO.get(nombre, 320)
        k2 = min(1.0, lado / max(pieza.size))
        if k2 < 1: pieza = pieza.resize((round(pieza.width * k2), round(pieza.height * k2)), Image.LANCZOS)
        nom = salidas[k]
        pieza.save(os.path.join(RAIZ, nom + '.png'), optimize=True)
        hechos[nom] = {'src': nom + '.png', 'w': pieza.width, 'h': pieza.height}
    print(nombre, '->', len(hechos))
    return hechos

# v392: el clavo de olor pasa a ser ingrediente propio. En la lamina esta dibujado al pie de la canela:
# se separa en ing_clavo.webp y la canela queda sin clavos (ing_canela.webp).
#   python tools/cw_recortar.py clavo
def separar_clavo():
    im = Image.open(os.path.join(ORIG, 'lamina_ingredientes.jpg')).convert('RGB')
    a = np.asarray(im).astype(np.float32); h, w, _ = a.shape
    fondo, bg = mascara_fondo(a)
    fg = ndimage.binary_opening(~fondo, iterations=1)
    etiq, n = ndimage.label(fg, structure=np.ones((3, 3)))
    tam = ndimage.sum(np.ones(fg.shape), etiq, range(1, n + 1)); objs = ndimage.find_objects(etiq)
    # celda de abajo a la izquierda (canela + clavos)
    celda = [i for i in range(n) if objs[i][0].start > h * 0.5 and objs[i][1].stop < w * 0.34 and tam[i] >= 12]
    canela = max(celda, key=lambda i: tam[i]); cy0, cy1 = objs[canela][0].start, objs[canela][0].stop; cx0, cx1 = objs[canela][1].start, objs[canela][1].stop
    clavo, resto = [], []
    for i in celda:
        if i == canela: continue
        sy, sx = objs[i]; my, mx = (sy.start + sy.stop) / 2, (sx.start + sx.stop) / 2
        # los clavos estan a la derecha y abajo de las rajas; lo demas (brillos sueltos) va con la canela
        (clavo if mx > cx0 + (cx1 - cx0) * 0.55 and my > cy0 + (cy1 - cy0) * 0.45 and tam[i] > 60 else resto).append(i)
    def guardar(ids, nom):
        m = np.isin(etiq, [x + 1 for x in ids]); ys, xs = np.where(m)
        y0, y1, x0, x1 = max(0, ys.min() - 6), min(h, ys.max() + 7), max(0, xs.min() - 6), min(w, xs.max() + 7)
        alfa = Image.fromarray((m[y0:y1, x0:x1] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
        pieza = im.crop((x0, y0, x1, y1)).convert('RGBA'); pieza.putalpha(alfa)
        k2 = min(1.0, 320 / max(pieza.size))
        if k2 < 1: pieza = pieza.resize((round(pieza.width * k2), round(pieza.height * k2)), Image.LANCZOS)
        pieza.save(os.path.join(RAIZ, nom + '.webp'), 'WEBP', quality=88, method=6)
        print(nom, pieza.size, len(ids), 'piezas')
    guardar(clavo, 'ing_clavo'); guardar([canela] + resto, 'ing_canela')

if __name__ == '__main__' and sys.argv[1:] == ['clavo']:
    separar_clavo(); sys.exit(0)
if __name__ == '__main__':
    todo = {}
    for nom, sal in LAMINAS.items(): todo.update(recortar(nom, sal))
    json.dump(todo, open(os.path.join(RAIZ, 'recortes.json'), 'w'), indent=0)
    print(len(todo), 'sprites')
