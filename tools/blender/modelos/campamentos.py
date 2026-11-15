# ═══════════════════════════════════════════════════════
# DUENDE QUEST — familia CAMPAMENTOS («medieval mistico»): los 10 lugares con nombre de la franja exterior
# (mmo/js/mundo3d.js LUGARES3D, armados en mundo/js/lugares.js). Sustituye, pieza a pieza, a los kits CC0 de
# Kenney (supervivencia, cementerio y piratas) con los que nacieron en v376: tiendas de lona, empalizadas,
# torres de vigia, hogueras, carromatos de madera, estandartes, lapidas, rejas, cripta, barcos...
# Diseños propios, generados por guion. Madera oscura curtida, lona cruda manchada, hierro negro, piedra
# envejecida con musgo; los unicos acentos son emisivos (brasa ambar, runa violeta o verde).
# Convenciones (GUIA.md): metros, Z arriba, FRENTE hacia -Y (en el juego, +Z), origen en el suelo y en el centro.
# Cada modelo tiene el tamaño de la pieza del kit a la que sustituye (en metros, con la escala de lugares.js);
# lugares.js ajusta lo que falte con la caja de la pieza. No declaran `sustituye`: los coloca lugares.js.
# Los tres niveles salen de la misma funcion: N(a, b, c) elige cuanta malla lleva cada uno.
# ═══════════════════════════════════════════════════════
import math
import numpy as np
from dq_lib import *

MADERA = '#4f3f2e'; MADERA_OSC = '#3a2d21'; MADERA_CLARA = '#6a563e'; MADERA_GRIS = '#5d5850'; CORTE = '#9a8462'
HIERRO = '#2f2f34'; HIERRO_CLARO = '#56565c'; OXIDO = '#5b3a26'
PIEDRA = '#807b72'; PIEDRA_OSC = '#625e57'; PIEDRA_CLARA = '#968f84'
LONA = '#8a7c62'; LONA_OSC = '#5f5446'; LONA_ROJA = '#6a3227'; CUERDA = '#8c7a58'
TIERRA = '#4a3a2b'; CENIZA = '#3b3836'; MUSGO = '#34421f'; BARRO = '#7a4a30'
BRASA = '#ffb45a'; LLAMA = '#ffcf7a'; VIOLETA = '#8a5cf0'; VERDE_RUNA = '#3fd6b4'
ESTANDARTE = '#5a1f1c'; ORO = '#a8843a'; NEGRO = '#1f1d22'; HUESO = '#cfc6b0'

_L = [0]


def N(a, b, c):
    """Valor segun el nivel de detalle que se esta construyendo (alto, medio, bajo)."""
    return (a, b, c)[_L[0]]


def pieza(nombre, tris, ao_dist=1.2, ao=0.75):
    """Como @modelo, pero deja el nivel a mano de N()."""
    def deco(fn):
        def f(lod):
            _L[0] = lod
            o = fn()
            # El nivel bajo (de lejos) se ajusta solo a su presupuesto: se reduce si se pasa.
            if lod == 2 and contar_tris(o) > tris[2] * 1.08:
                decimar(o, tris[lod]); suavizar(o, 45)
            return o
        return modelo(nombre, tris=tris, ao=ao, ao_dist=ao_dist)(f)
    return deco


# ═══════════════ ayudas ═══════════════
def caja(dx, dy, dz, loc=(0, 0, 0), rot=(0, 0, 0), marca='madera', color=MADERA, bisel=0.0, tono=0.0, semilla=0):
    """Caja centrada en loc. bisel: solo en el nivel alto. tono: manchas de color."""
    o = primitiva('cubo', marca=marca, color=color, lado=1.0)
    mover(o, esc=(dx, dy, dz))
    if bisel and _L[0] == 0: biselar(o, min(bisel, min(dx, dy, dz) * 0.3), 1)
    mover(o, loc, rot)
    if tono: variar(o, tono, 1.7, semilla)
    return o


def torno(perfil, lados=12, marca='liso', color='#888888', loc=(0, 0, 0), fase=0.0, esc=(1, 1)):
    """Solido de revolucion alrededor de Z. perfil: [(radio, z)...]; con radio 0 en un extremo cierra en un vertice."""
    verts = []; caras = []; anillos = []
    for r, z in perfil:
        if r <= 1e-6:
            anillos.append([len(verts)]); verts.append((0, 0, z))
        else:
            anillos.append(list(range(len(verts), len(verts) + lados)))
            for k in range(lados):
                a = 2 * math.pi * k / lados + fase
                verts.append((math.cos(a) * r * esc[0], math.sin(a) * r * esc[1], z))
    for i in range(len(anillos) - 1):
        A, B = anillos[i], anillos[i + 1]
        if len(A) == 1 and len(B) == 1: continue
        for k in range(lados):
            k2 = (k + 1) % lados
            if len(A) == 1: caras.append((A[0], B[k2], B[k]))
            elif len(B) == 1: caras.append((A[k], A[k2], B[0]))
            else: caras.append((A[k], A[k2], B[k2], B[k]))
    o = malla('torno', verts, caras, marca, color)
    return mover(o, loc)


def barra(a, b, r=0.03, lados=4, marca='liso', color=HIERRO, punta=False, tapa=False):
    """Barra recta de a a b."""
    return tubo([a, b], r, lados, 'barra', marca, color, punta=punta, tapa_base=tapa)


def palo(a, b, r=0.06, color=MADERA, semilla=0, lados=None, punta=True, marca='madera'):
    """Poste o rama de madera de a a b, con su tono propio."""
    o = tubo([a, b], r, lados or N(6, 5, 4), 'palo', marca, color, punta=punta)
    variar(o, 0.18, 3.0, semilla)
    return o


def lamina(fn, nu, nv, marca='liso', color=LONA, dos=True):
    """Tela o tablero fino: fn(u, v) → (x, y, z) con u, v en 0..1. dos: con las dos caras (se ve por dentro)."""
    verts = [fn(i / nu, j / nv) for j in range(nv + 1) for i in range(nu + 1)]
    caras = []
    for j in range(nv):
        for i in range(nu):
            a = j * (nu + 1) + i; caras.append((a, a + 1, a + nu + 2, a + nu + 1))
    o = malla('lamina', verts, caras, marca, color)
    if dos: dos_caras(o)
    return o


def _es_marca(o, marca):
    """Mascara de los vertices que tocan caras de esa marca."""
    me = o.data; nombres = [m_.name for m_ in me.materials]; r = np.zeros(len(me.vertices), dtype=bool)
    if 'dq_' + marca not in nombres: return r
    idx = nombres.index('dq_' + marca)
    for pol in me.polygons:
        if pol.material_index == idx:
            for v in pol.vertices: r[v] = True
    return r


def envejecer(o, musgo=0.0, base=0.25, z_musgo=0.5, sem=3):
    """Suciedad hacia el suelo y musgo opcional en lo que mira arriba y cerca del suelo."""
    if base: pintar_fn(o, lambda P, Nn, C: C * (1 - base * np.clip(1 - P[:, 2] / 0.5, 0, 1) ** 1.5)[:, None])
    if musgo: manchar(o, MUSGO, lambda P, Nn: (Nn[:, 2] * 0.9 + np.clip(z_musgo - P[:, 2], 0, 1) * 1.1) * musgo, 0.85, 2.6, sem)
    return o


def acabar(p, nombre, musgo=0.0, base=0.3, ang=42, z_musgo=0.5, guardar=('emisivo',), luz=0.3, sombra=0.3):
    """Une, ensucia, gasta los cantos y suaviza; las caras de `guardar` conservan su color exacto."""
    o = unir([x for x in p if x is not None], nombre)
    m = np.zeros(len(o.data.vertices), dtype=bool)
    for g in guardar: m |= _es_marca(o, g)
    C0 = color_de(o)
    envejecer(o, musgo=musgo, base=base, z_musgo=z_musgo); desgastar(o, luz, sombra)
    C = color_de(o); C[m] = C0[m]; poner_color(o, C)
    return suavizar(o, ang)


def piedra_suelta(r, loc, semilla, color=PIEDRA, esc=(1, 1, 0.7), marca='monolito'):
    """Canto rodado irregular."""
    o = esfera(loc, r, 1, esc, marca=marca, color=color)
    if _L[0] < 2: desplazar(o, r * 0.35, 1.3 / r, semilla)
    variar(o, 0.25, 2.0 / r, semilla)
    o['dq_afilado'] = 1
    return o


def roca(bolas, tris, semilla=0, color=PIEDRA, musgo=0.6, voxel=0.3):
    """Peñasco: bolas fundidas, arrugadas y con cantos gastados; musgo en lo que mira arriba."""
    o = masa(bolas, voxel=voxel, tris=tris, ruido_f=0.22, ruido_e=0.7, semilla=semilla, marca='monolito', inflado=0.2, nombre='roca')
    pintar(o, color)
    variar(o, 0.28, 0.9, semilla); variar(o, 0.12, 4.0, semilla + 1, tono=PIEDRA_OSC)
    if musgo: manchar(o, MUSGO, lambda P, Nn: Nn[:, 2] * 1.1 * musgo - 0.15, 0.8, 1.6, semilla + 2)
    desgastar(o, 0.35, 0.35)
    return suavizar(o, 55)


def brasas(r, z, semilla=0, llamas=True):
    """Leños cruzados, ascuas encendidas (marca emisiva) y lenguas de fuego bajas."""
    rng = azar(semilla + 80); out = []; m = N(5, 3, 0)
    for k in range(m):
        a = k * math.pi * 2 / max(m, 1) + rng.uniform(-0.3, 0.3); d = np.array([math.cos(a), math.sin(a), 0])
        l = barra(tuple(d * r * 1.05 + [0, 0, z + 0.03]), tuple(-d * r * 0.2 + [0, 0, z + r * 0.45]), r * 0.12, N(5, 4, 3), 'madera', '#2a211b', tapa=True)
        pintar_fn(l, lambda P, Nn, C: C + hexlin('#b8431c')[None, :] * (np.clip(1 - np.hypot(P[:, 0], P[:, 1]) / (r * 0.6), 0, 1) * 0.6)[:, None]); out.append(l)
    b = torno([(r * 0.75, z), (r * 0.5, z + r * 0.18), (r * 0.2, z + r * 0.3), (0, z + r * 0.32)], N(9, 6, 5), 'emisivo', BRASA)
    if _L[0] == 0: desplazar(b, r * 0.06, 6.0 / r, semilla)
    pintar_fn(b, lambda P, Nn, C: hexlin('#ff7a2a')[None, :] * (0.55 + 0.75 * np.clip(ruido_fbm(P, 9.0 / r, semilla) + 0.35, 0, 1))[:, None] + hexlin('#ffd27a')[None, :] * (0.5 * np.clip(ruido_fbm(P, 6.0 / r, semilla + 5), 0, 1))[:, None])
    out.append(b)
    if llamas and _L[0] < 2:
        for k in range(N(3, 2, 0)):
            a = k * 2.1 + rng.uniform(0, 0.5); c = (math.cos(a) * r * 0.18, math.sin(a) * r * 0.18)
            f = torno([(r * 0.16, z + r * 0.2), (r * 0.1, z + r * 0.55), (0, z + r * (0.9 + 0.25 * k % 2))], 5, 'emisivo', LLAMA, loc=(c[0], c[1], 0))
            pintar_fn(f, lambda P, Nn, C: hexlin('#ff8a30')[None, :] * (1 - np.clip((P[:, 2] - z) / r, 0, 1))[:, None] + hexlin('#ffe0a0')[None, :] * np.clip((P[:, 2] - z) / r, 0, 1)[:, None])
            out.append(f)
    return out


def anillo_piedras(r, n, tam, semilla=0, z=0.0, color=PIEDRA):
    rng = azar(semilla + 30); out = []
    n = N(n, 5, 0)
    if n == 0: return [torno([(r + tam, z - 0.1), (r + tam * 0.8, z + tam * 0.9), (r - tam * 0.6, z + tam * 0.9), (r - tam, z - 0.1)], 8, 'monolito', color)]
    for i in range(n):
        a = 2 * math.pi * i / n + rng.uniform(-0.1, 0.1); s = tam * rng.uniform(0.8, 1.2)
        out.append(piedra_suelta(s, (math.cos(a) * r, math.sin(a) * r, z + s * 0.35), semilla + i, hexlin(color) * rng.uniform(0.8, 1.15), (1.2, 1.0, 0.75)))
    return out


def tablas(n, largo, ancho, grosor, loc=(0, 0, 0), eje='x', color=MADERA, semilla=0, hueco=0.015, bisel=0.012, marca='madera', faltan=()):
    """n tablas una junto a otra formando un tablero de `ancho`. eje: hacia donde corren. En medio y bajo, una sola."""
    rng = azar(semilla + 100)
    if _L[0] > 0: n = 1; faltan = ()
    w = ancho / n; out = []
    for i in range(n):
        if i in faltan: continue
        c = hexlin(color) * rng.uniform(0.75, 1.2); d = (i + 0.5) * w - ancho / 2
        L = largo * (1 if n == 1 else rng.uniform(0.96, 1.0)); dz = rng.uniform(-0.01, 0.01) if n > 1 else 0
        if eje == 'x': o = caja(L, w - hueco, grosor, (loc[0], loc[1] + d, loc[2] + dz), marca=marca, color=c, bisel=bisel, tono=0.16, semilla=semilla + i)
        else: o = caja(w - hueco, L, grosor, (loc[0] + d, loc[1], loc[2] + dz), marca=marca, color=c, bisel=bisel, tono=0.16, semilla=semilla + i)
        out.append(o)
    return out


def runa(loc, ancho, alto, color=VIOLETA, rot=(0, 0, 0), grosor=0.02):
    """Runa grabada que brilla: un rombo con un trazo vertical (diseño propio)."""
    out = []
    w = ancho * 0.12
    for a, b in (((0, 0, -alto / 2), (0, 0, alto / 2)), ((-ancho / 2, 0, 0), (0, 0, alto / 2)), ((ancho / 2, 0, 0), (0, 0, alto / 2)), ((-ancho / 2, 0, 0), (0, 0, -alto / 3)), ((ancho / 2, 0, 0), (0, 0, -alto / 3))):
        d = np.array(b) - np.array(a); L = float(np.linalg.norm(d)); c = (np.array(a) + np.array(b)) / 2
        ang = math.atan2(d[0], d[2])
        o = caja(w, grosor, L + w, tuple(c), (0, ang, 0), marca='emisivo', color=color)
        out.append(o)
    o = unir(out, 'runa'); mover(o, loc, rot)
    return o


# ═══════════════ CAMPAMENTO: tiendas, hogueras, enseres ═══════════════
def _tienda(color, semilla, parche):
    """Tienda de lona a dos aguas (2,8 × 2,8 × 2,46): cumbrera sobre dos postes, entrada con las solapas recogidas."""
    W, D, H = 1.32, 1.3, 2.32; p = []
    nu, nv = N(4, 2, 1), N(5, 3, 1)
    for s in (-1, 1):
        def f(u, v, s=s):
            y = -D + 2 * D * v
            comba = 0.11 * math.sin(math.pi * u) * (0.35 + 0.65 * math.sin(math.pi * v))
            return (s * (W * u + 0.08 * u ** 3 - comba * 0.5), y + (0.05 * u * (1 if v > 0.5 else -1) if v in (0, 1) else 0), H * (1 - u) - comba + 0.02)
        o = lamina(f, nu, nv, 'liso', color)
        p.append(o)
    # pared del fondo y solapas de la entrada (triangulos de lona)
    p.append(lamina(lambda u, v: ((-W + 2 * W * u) * (1 - v), D, H * v), 2, N(2, 1, 1), 'liso', hexlin(color) * 0.85))
    for s in (-1, 1):
        p.append(lamina(lambda u, v, s=s: (s * (W - (W - 0.42) * u * (1 - v)) * (1 - v) + s * 0.0, -D - 0.12 * u * (1 - v), H * v), 1, N(2, 1, 1), 'liso', hexlin(color) * 0.92))
    # suelo de la tienda (oscuro: se ve la entrada)
    p.append(caja(2 * W - 0.2, 2 * D - 0.1, 0.03, (0, 0.05, 0.015), marca='liso', color='#2b241d'))
    # postes y cumbrera
    for y in (-D - 0.02, D + 0.02): p.append(palo((0, y, -0.3), (0, y, H + 0.16), 0.045, MADERA_OSC, semilla + int(y * 10)))
    p.append(palo((0, -D - 0.12, H + 0.04), (0, D + 0.12, H + 0.04), 0.035, MADERA, semilla + 3, punta=False))
    if _L[0] == 0:   # vientos y estacas
        for y in (-D, D):
            for s in (-1, 1):
                a = (0, y, H + 0.1); b = (s * 0.25, y + (-0.45 if y < 0 else 0.45) * 0.3, 0.02)
                p.append(barra(a, b, 0.008, 3, 'liso', CUERDA))
        for s in (-1, 1):
            for y in (-0.8, 0, 0.8): p.append(palo((s * (W + 0.1), y, -0.2), (s * (W + 0.12), y, 0.18), 0.025, MADERA_CLARA, 7 + int(y * 5) * s, lados=4))
    o = unir(p, 'tienda')
    # manchas de lluvia y barro abajo; un parche de otro tono
    pintar_fn(o, lambda P, Nn, C: C * (0.72 + 0.28 * np.clip(P[:, 2] / 0.9, 0, 1))[:, None])
    variar(o, 0.16, 1.4, semilla, tono=LONA_OSC)
    if parche: manchar(o, parche, lambda P, Nn: (np.abs(P[:, 2] - 1.2) < 0.45) * 1.0, 0.75, 0.8, semilla + 4, 0.1)
    return suavizar(o, 50)


@pieza('tienda', (520, 160, 60), ao_dist=1.5)
def tienda(): return _tienda(LONA, 1, None)


@pieza('tienda_media', (440, 130, 50), ao_dist=1.4)
def tienda_media():
    """Sombrajo de lona (2,8 × 2,8 × 2,46): una lona tendida de un travesaño a dos postes y estacada atras; dentro, un petate."""
    W, D, H = 1.3, 1.25, 2.3; p = []
    def f(u, v):
        comba = 0.16 * math.sin(math.pi * v) * (0.4 + 0.6 * math.sin(math.pi * u))
        return (-W + 2 * W * u, -D + 2.45 * D * v, H - (H - 0.08) * v ** 1.15 - comba)
    p.append(lamina(f, N(4, 2, 1), N(4, 2, 1), 'liso', '#7d6f57'))
    p.append(lamina(lambda u, v: (-W - 0.02, -D + 2.4 * D * u * (1 - v * 0.98), (H - 0.1) * v * (1 - u) + 0.02), 2, 1, 'liso', hexlin('#7d6f57') * 0.82))
    for s in (-1, 1): p.append(palo((s * W, -D, -0.3), (s * W, -D, H + 0.12), 0.05, MADERA_OSC, 2 + s))
    p.append(palo((-W - 0.15, -D, H - 0.02), (W + 0.15, -D, H - 0.02), 0.04, MADERA, 4, punta=False))
    if _L[0] < 2:
        p.append(caja(0.7, 1.5, 0.1, (0.25, 0.2, 0.05), marca='liso', color='#4a3d31', bisel=0.03))
        p.append(tubo([(-0.1, -0.45, 0.13), (0.6, -0.45, 0.13)], 0.11, N(7, 5, 4), 'rollo', 'liso', '#5a4636'))
    o = unir(p, 'tienda_media')
    pintar_fn(o, lambda P, Nn, C: C * (0.72 + 0.28 * np.clip(P[:, 2] / 0.9, 0, 1))[:, None])
    variar(o, 0.16, 1.4, 9, tono=LONA_OSC)
    return suavizar(o, 50)


@pieza('hoguera', (520, 221, 60), ao_dist=0.9)
def hoguera():
    """Hoguera de campamento (1,4 × 1,35 × 0,55): cerco de piedras, ceniza, leños cruzados y ascuas."""
    p = anillo_piedras(0.56, 9, 0.15, 3, -0.03, PIEDRA_OSC)
    p.append(torno([(0.5, 0.0), (0.42, 0.04), (0, 0.05)], N(10, 8, 6), 'liso', CENIZA))
    p += brasas(0.42, 0.04, 2)
    return acabar(p, 'hoguera', base=0.15, guardar=('emisivo',))


@pieza('asador', (380, 182, 40), ao_dist=1.0)
def asador():
    """Asador (2 × 0,6 × 1,4): dos horquillas, travesaño y una olla de hierro colgada."""
    p = []
    for s in (-1, 1):
        x = s * 0.9
        p.append(palo((x, 0, -0.25), (x, 0, 1.22), 0.05, MADERA_OSC, 3 + s))
        p.append(palo((x, 0, 1.12), (x + s * 0.12, 0, 1.42), 0.03, MADERA_OSC, 5 + s))
        p.append(palo((x, 0, 1.12), (x - s * 0.1, 0, 1.4), 0.03, MADERA_OSC, 6 + s))
    p.append(palo((-1.02, 0, 1.28), (1.02, 0, 1.28), 0.035, MADERA, 8, punta=False))
    p.append(barra((0, 0, 1.27), (0, 0, 0.82), 0.012, 3, 'liso', HIERRO))
    p.append(torno([(0, 0.42), (0.2, 0.46), (0.27, 0.58), (0.26, 0.78), (0.23, 0.82), (0.2, 0.8), (0.0, 0.76)] if _L[0] < 2 else [(0, 0.42), (0.26, 0.6), (0.23, 0.82), (0, 0.8)], N(10, 7, 5), 'liso', HIERRO))
    return acabar(p, 'asador', base=0.2)


@pieza('petate', (240, 70, 24), ao_dist=0.7)
def petate():
    """Petate de viaje (1,5 × 3 × 0,4): manta extendida, rollo en la cabecera y una piel encima."""
    p = [caja(1.1, 2.2, 0.08, (0, 0.15, 0.04), marca='liso', color='#55473a', bisel=0.03, tono=0.15, semilla=2)]
    p.append(tubo([(-0.5, -0.95, 0.17), (0.5, -0.95, 0.17)], 0.17, N(8, 6, 4), 'rollo', 'liso', '#6b5a45'))
    if _L[0] < 2:
        piel = lamina(lambda u, v: (-0.5 + u + 0.05 * math.sin(v * 7), -0.2 + 1.3 * v, 0.09 + 0.04 * math.sin(u * math.pi) + 0.02 * math.sin(v * 9)), N(3, 2, 1), N(3, 2, 1), 'liso', '#4a3a2a', dos=False)
        variar(piel, 0.3, 4.0, 3); p.append(piel)
    return acabar(p, 'petate', base=0.1)


def _barril(alto=1.4, r=0.5, semilla=0, tapa=True):
    L = N(12, 8, 6); pz = [0, 0.04, 0.25, 0.5, 0.75, 0.96, 1.0]; bz = [0.86, 0.9, 0.99, 1.04, 0.99, 0.9, 0.86]
    if _L[0] == 2: pz = [0, 0.5, 1.0]; bz = [0.88, 1.04, 0.88]
    perfil = [(0, 0)] + [(r * b, alto * z) for z, b in zip(pz, bz)]
    perfil += [(r * 0.8, alto), (r * 0.8, alto - 0.04), (0, alto - 0.04)] if tapa and _L[0] < 2 else [(0, alto)]
    o = torno(perfil, L, 'madera', MADERA)
    rng = azar(semilla + 40); P = pos(o); k = np.round((np.arctan2(P[:, 1], P[:, 0]) / (2 * math.pi) * L)).astype(int) % L
    tonos = rng.uniform(0.75, 1.22, L); C = hexlin(MADERA)[None, :] * tonos[k][:, None]
    C[(np.hypot(P[:, 0], P[:, 1]) < r * 0.82) & (P[:, 2] > alto * 0.9)] = hexlin(MADERA_OSC) * 1.1
    poner_color(o, C)
    p = [o]
    if _L[0] < 2:
        for z, b in ((0.1, 0.895), (0.33, 1.0), (0.64, 1.0), (0.88, 0.9)) if _L[0] == 0 else ((0.12, 0.9), (0.84, 0.91)):
            p.append(torno([(r * b + 0.015, alto * z), (r * b + 0.015, alto * z + 0.06)], L, 'liso', HIERRO))
    return unir(p, 'barril')


@pieza('barril', (380, 182, 40), ao_dist=0.9)
def barril(): return acabar([_barril()], 'barril', base=0.3)


def _cajon(dx, dy, dz, semilla=0, abierta=False):
    """Cajon de tablas con listones en los cantos."""
    p = []; g = 0.05; rng = azar(semilla + 60)
    if _L[0] == 2:
        p.append(caja(dx, dy, dz, (0, 0, dz / 2), color=hexlin(MADERA_CLARA) * rng.uniform(0.8, 1.05), tono=0.2, semilla=semilla))
        return p
    nt = N(2, 1, 1)
    for sy in (-1, 1):
        for i in range(nt):
            h = dz / nt
            p.append(caja(dx, g, h - 0.02, (0, sy * (dy / 2 - g / 2), (i + 0.5) * h), color=hexlin(MADERA_CLARA) * rng.uniform(0.72, 1.1), tono=0.15, semilla=semilla + i))
    for sx in (-1, 1):
        for i in range(nt):
            h = dz / nt
            p.append(caja(g, dy - 2 * g, h - 0.02, (sx * (dx / 2 - g / 2), 0, (i + 0.5) * h), color=hexlin(MADERA_CLARA) * rng.uniform(0.7, 1.0), tono=0.15, semilla=semilla + 9 + i))
    p.append(caja(dx - 0.02, dy - 0.02, g, (0, 0, g / 2 if abierta else dz - g / 2), color=hexlin(MADERA_CLARA) * 0.9, tono=0.15, semilla=semilla + 20))
    if _L[0] == 0:
        for sx in (-1, 1):
            for sy in (-1, 1):
                p.append(caja(0.1, 0.04, dz + 0.02, (sx * (dx / 2 - 0.05), sy * (dy / 2 + 0.015), dz / 2), color=MADERA_OSC))
        if not abierta:
            p.append(caja(dx * 1.1, 0.04, 0.09, (0, -dy / 2 - 0.02, dz * 0.5), (0, math.atan2(dz, dx) * 0.9, 0), color=MADERA_OSC))
    return p


@pieza('cajon', (300, 90, 14), ao_dist=0.9)
def cajon(): return acabar(_cajon(1.2, 1.2, 1.2, 1), 'cajon', base=0.3)


@pieza('cajon_abierto', (520, 160, 30), ao_dist=0.9)
def cajon_abierto():
    """Cajon abierto (1,25 × 2,5 × 1,5): la tapa apoyada al lado y botijas de barro dentro."""
    p = _cajon(1.2, 2.4, 1.15, 4, abierta=True)
    if _L[0] < 2:
        p.append(caja(1.2, 0.06, 1.3, (0.0, -1.32, 0.6), (math.radians(-12), 0, 0), color=hexlin(MADERA_CLARA) * 0.85, tono=0.15, semilla=8))
        rng = azar(9)
        for i in range(N(4, 2, 0)):
            x = -0.3 + (i % 2) * 0.6; y = -0.6 + (i // 2) * 1.0
            p.append(torno([(0, 0.05), (0.26, 0.35), (0.2, 0.62), (0.09, 0.72), (0.1, 0.84), (0, 0.84)] if _L[0] == 0 else [(0, 0.05), (0.26, 0.35), (0.1, 0.8), (0, 0.84)], N(7, 5, 4), 'liso', hexlin(BARRO) * rng.uniform(0.8, 1.15), loc=(x, y, 0.3)))
    return acabar(p, 'cajon_abierto', base=0.3)


@pieza('cubo', (320, 194, 24), ao_dist=0.6)
def cubo():
    """Cubo de duelas (0,72 × 0,96): asa de cuerda y agua oscura."""
    o = _barril(0.75, 0.32, 3, tapa=False)
    p = [o, torno([(0.29, 0.62), (0, 0.62)], N(10, 8, 6), 'liso', '#23312f')]
    if _L[0] < 2: p.append(tubo(curva([(-0.33, 0, 0.7), (0, 0, 0.98), (0.33, 0, 0.7)], 7), 0.012, 3, 'asa', 'liso', CUERDA, punta=False))
    return acabar(p, 'cubo', base=0.25)


@pieza('cofre', (480, 173, 40), ao_dist=0.9)
def cofre():
    """Cofre de viaje (1,3 × 1,3 × 1,3 en la escala del kit): tablas, tapa abovedada, flejes y cerradura."""
    W, D, H = 1.1, 0.8, 0.62; p = []
    p.append(caja(W, D, H, (0, 0, H / 2 + 0.04), color=MADERA, bisel=0.02, tono=0.18, semilla=2))
    t = tubo([(-W / 2, 0, H + 0.04), (W / 2, 0, H + 0.04)], D / 2, N(10, 7, 5), 'tapa', 'madera', MADERA_CLARA, punta=False, tapa_base=True)
    deformar(t, lambda P: np.where((P[:, 2] < H + 0.04)[:, None], np.stack([P[:, 0], P[:, 1], np.full(len(P), H + 0.04)], 1), P))
    variar(t, 0.18, 2.0, 4); p.append(t)
    p.append(caja(0.06, D + 0.01, 0.06, (W / 2 + 0.005, 0, H + 0.07), color=MADERA_OSC))
    p.append(caja(0.06, D + 0.01, 0.06, (-W / 2 - 0.005, 0, H + 0.07), color=MADERA_OSC))
    for x in ((-0.38, 0.38) if _L[0] < 2 else ()):
        p.append(caja(0.08, D + 0.03, H + 0.02, (x, 0, H / 2 + 0.04), marca='liso', color=HIERRO))
        b = tubo([(x - 0.04, 0, H + 0.04), (x + 0.04, 0, H + 0.04)], D / 2 + 0.015, N(10, 7, 5), 'fleje', 'liso', HIERRO, punta=False)
        deformar(b, lambda P: np.where((P[:, 2] < H + 0.04)[:, None], np.stack([P[:, 0], P[:, 1], np.full(len(P), H + 0.04)], 1), P)); p.append(b)
    if _L[0] < 2: p.append(caja(0.14, 0.04, 0.18, (0, -D / 2 - 0.02, H + 0.0), marca='liso', color=ORO))
    for sx in (-1, 1):
        for sy in (-1, 1): p.append(caja(0.12, 0.12, 0.06, (sx * (W / 2 - 0.08), sy * (D / 2 - 0.08), 0.02), color=MADERA_OSC))
    return acabar(p, 'cofre', base=0.3)


# ── empalizada, tablados, entibados ──
@pieza('empalizada', (380, 229, 24), ao_dist=1.0)
def empalizada():
    """Tramo de empalizada (2,5 × 0,3 × 2,6): troncos aguzados atados a un larguero, cada uno de su alto."""
    rng = azar(11); p = []; n = N(7, 7, 1)
    if n == 1:
        o = caja(2.5, 0.26, 2.4, (0, 0, 1.1), color=MADERA, tono=0.2, semilla=2)
        p.append(o)
        return acabar(p, 'empalizada', base=0.3)
    for i in range(n):
        x = -1.25 + (i + 0.5) * 2.5 / n; r = 2.5 / n / 2 * rng.uniform(0.86, 1.0); h = 2.15 + rng.uniform(-0.15, 0.12)
        o = torno([(0, -0.3), (r, -0.3), (r * 0.97, h), (r * 0.25, h + 0.32), (0, h + 0.38)], N(6, 5, 4), 'madera', hexlin(MADERA) * rng.uniform(0.78, 1.18), loc=(x, 0, 0), fase=rng.uniform(0, 1))
        pintar_fn(o, lambda P, Nn, C: np.where((P[:, 2] > h + 0.05)[:, None], hexlin(CORTE) * 0.8, C))
        mover(o, rot=(rng.uniform(-0.03, 0.03), rng.uniform(-0.025, 0.025), 0))
        p.append(o)
    for z in ((0.55, 1.75) if _L[0] == 0 else (1.2,)):
        p.append(caja(2.5, 0.08, 0.14, (0, 0.17, z), color=MADERA_OSC, tono=0.15, semilla=int(z * 10)))
    if _L[0] == 0:
        for i in range(n): p.append(caja(0.035, 0.26, 0.05, (-1.25 + (i + 0.5) * 2.5 / n, 0.02, 1.75), marca='liso', color=CUERDA))
    return acabar(p, 'empalizada', base=0.35, musgo=0.25, z_musgo=0.4)


@pieza('tablado', (300, 90, 14), ao_dist=0.6)
def tablado():
    """Tablado viejo (2,5 × 2,5 × 0,26): tablas gastadas sobre dos durmientes, a una le falta un trozo."""
    p = tablas(6, 2.5, 2.5, 0.07, (0, 0, 0.2), eje='x', color=MADERA_GRIS, semilla=3, faltan=(4,))
    if _L[0] == 0: p.append(caja(1.1, 2.5 / 6 - 0.02, 0.07, (-0.7, 2.5 / 6 * 4.5 - 1.25, 0.2), color=MADERA_GRIS, bisel=0.01, tono=0.2, semilla=9))
    for y in (-0.9, 0.9): p.append(caja(2.4, 0.16, 0.18, (0, y, 0.08), color=MADERA_OSC, tono=0.15, semilla=4))
    return acabar(p, 'tablado', base=0.25, musgo=0.2)


@pieza('muelle', (460, 140, 30), ao_dist=1.0)
def muelle():
    """Tramo de muelle (2,5 × 2,5 × 1,3): tablazon sobre cuatro pilotes hincados, con un noray de cuerda."""
    p = tablas(5, 2.5, 2.5, 0.08, (0, 0, 1.24), eje='x', color=MADERA_GRIS, semilla=6)
    for y in (-1.05, 1.05): p.append(caja(2.5, 0.16, 0.2, (0, y, 1.1), color=MADERA_OSC, tono=0.15, semilla=7))
    for x in (-1.05, 1.05):
        for y in (-1.05, 1.05):
            o = torno([(0.13, -0.6), (0.14, 1.28), (0.1, 1.42), (0, 1.44)], N(7, 5, 4), 'madera', MADERA_OSC, loc=(x, y + (0.1 if y > 0 else -0.1), 0))
            manchar(o, '#2e3a2a', lambda P, Nn: (P[:, 2] < 0.5) * 1.0, 0.9, 3.0, 4)
            p.append(o)
    if _L[0] == 0: p.append(torno([(0.15, 1.42), (0.15, 1.48)], 8, 'liso', CUERDA, loc=(1.05, -1.15, 0)))
    return acabar(p, 'muelle', base=0.0, musgo=0.0)


@pieza('entibado', (360, 110, 14), ao_dist=0.8)
def entibado():
    """Entibado de mina (2,5 × 0,25 × 2,5): tablones verticales clavados a dos pies derechos y un cabezal."""
    p = []; rng = azar(13)
    for i in range(N(5, 1, 1)):
        n = N(5, 1, 1); w = 2.1 / n
        p.append(caja(w - 0.02, 0.06, 2.25, (-1.05 + (i + 0.5) * w, 0.03, 1.12), color=hexlin(MADERA_GRIS) * rng.uniform(0.75, 1.15), bisel=0.01, tono=0.18, semilla=i))
    for x in (-1.15, 1.15): p.append(caja(0.2, 0.2, 2.5, (x, -0.04, 1.2), color=MADERA_OSC, bisel=0.02, tono=0.15, semilla=4))
    p.append(caja(2.5, 0.22, 0.22, (0, -0.04, 2.38), color=MADERA_OSC, bisel=0.02, tono=0.15, semilla=5))
    return acabar(p, 'entibado', base=0.3)


@pieza('pila_tablas', (240, 70, 14), ao_dist=0.6)
def pila_tablas():
    """Pila de tablones (1,9 × 3,1 × 0,47) sobre dos calzos."""
    rng = azar(14); p = []
    for k in range(N(3, 2, 1)):
        n = N(4, 1, 1)
        for i in range(n):
            w = 1.6 / n
            p.append(caja(w - 0.03, 3.0 * rng.uniform(0.93, 1.0), 0.1, (-0.8 + (i + 0.5) * w + rng.uniform(-0.03, 0.03), rng.uniform(-0.05, 0.05), 0.15 + k * 0.11 * (3 / N(3, 2, 1))), (0, 0, rng.uniform(-0.03, 0.03)), color=hexlin(MADERA_CLARA) * rng.uniform(0.8, 1.15), tono=0.15, semilla=k * 5 + i))
    for y in (-1.1, 1.1): p.append(caja(1.8, 0.14, 0.1, (0, y, 0.05), color=MADERA_OSC))
    return acabar(p, 'pila_tablas', base=0.2)


@pieza('lena', (220, 70, 14), ao_dist=0.6)
def lena():
    """Montoncito de leña partida (1 × 0,45 × 0,3)."""
    rng = azar(15); p = []
    if _L[0] == 2: return acabar([caja(0.95, 0.4, 0.26, (0, 0, 0.13), color=MADERA, tono=0.2)], 'lena')
    for k, (y, z) in enumerate(((-0.1, 0.08), (0.1, 0.08), (0.0, 0.22)) if _L[0] == 0 else ((0, 0.1),)):
        o = tubo([(-0.48, y, z), (0.48, y, z)], 0.085 if _L[0] == 0 else 0.13, N(5, 5, 4), 'leño', 'madera', hexlin(MADERA) * rng.uniform(0.8, 1.2), punta=False, tapa_base=True)
        pintar_fn(o, lambda P, Nn, C: np.where((np.abs(Nn[:, 0]) > 0.7)[:, None], hexlin(CORTE), C))
        p.append(o)
    return acabar(p, 'lena', base=0.2)


@pieza('mineral', (300, 126, 30), ao_dist=0.8)
def mineral():
    """Mena de la mina (0,85 × 0,7 × 0,55): roca oscura con vetas de cristal violeta que brillan."""
    p = [roca([(0, 0, 0.18, 0.42, 0.36, 0.3), (0.15, 0.05, 0.3, 0.25)], N(220, 90, 30), 4, PIEDRA_OSC, musgo=0.0, voxel=0.08)]
    if _L[0] < 2:
        rng = azar(16)
        for i in range(N(4, 2, 0)):
            a = rng.uniform(0, 6.28); c = (math.cos(a) * 0.22, math.sin(a) * 0.18, 0.3)
            o = torno([(0, 0), (0.05, 0.03), (0.035, 0.2), (0, 0.27)], 4, 'emisivo', VIOLETA)
            mover(o, rot=(rng.uniform(-0.6, 0.6), rng.uniform(-0.6, 0.6), 0)); mover(o, loc=c)
            p.append(o)
    return acabar(p, 'mineral', base=0.1, guardar=('emisivo',))


@pieza('letrero', (260, 80, 20), ao_dist=0.8)
def letrero():
    """Poste indicador (1,05 × 0,2 × 2,3): dos tablas en flecha con muescas talladas."""
    p = [palo((0, 0, -0.3), (0, 0, 2.25), 0.07, MADERA_OSC, 2)]
    for k, (z, s, ang) in enumerate(((1.85, 1, 0.08), (1.45, -1, -0.12))):
        n = 'tabla'
        w = 0.95
        o = malla(n, [(0, -0.03, -0.13), (w * 0.8, -0.03, -0.13), (w, -0.03, 0), (w * 0.8, -0.03, 0.13), (0, -0.03, 0.13), (0, 0.03, -0.13), (w * 0.8, 0.03, -0.13), (w, 0.03, 0), (w * 0.8, 0.03, 0.13), (0, 0.03, 0.13)],
                  [(0, 1, 2, 3, 4), (9, 8, 7, 6, 5), (0, 5, 6, 1), (1, 6, 7, 2), (2, 7, 8, 3), (3, 8, 9, 4), (4, 9, 5, 0)], 'madera', hexlin(MADERA_CLARA) * (1.0 - 0.1 * k))
        mover(o, (-0.12 if s > 0 else 0.12, 0, 0), esc=(s, 1, 1)); mover(o, (0, 0, z), (0, ang, 0))
        variar(o, 0.2, 3.0, k); p.append(o)
        if _L[0] == 0:
            for j in range(3): p.append(caja(0.1, 0.012, 0.03, (s * (0.15 + j * 0.16), -0.035, z + 0.01 * j), marca='liso', color='#2a2119'))
    return acabar(p, 'letrero', base=0.3, musgo=0.2)


# ── cobertizo (armazon y tejado por separado: el kit los apila) ──
@pieza('cobertizo', (420, 174, 40), ao_dist=1.6)
def cobertizo():
    """Armazon de cobertizo (2,5 × 2,5 × 2,5): cuatro pies derechos, carreras, tornapuntas y un murete de tablas atras."""
    p = []; h = 2.5
    for sx in (-1, 1):
        for sy in (-1, 1): p.append(caja(0.18, 0.18, h + 0.3, (sx * 1.15, sy * 1.15, h / 2 - 0.15), color=MADERA_OSC, bisel=0.02, tono=0.15, semilla=sx + 2 * sy))
    for sy in (-1, 1): p.append(caja(2.5, 0.16, 0.2, (0, sy * 1.15, h - 0.1), color=MADERA, tono=0.15, semilla=4 + sy))
    for sx in (-1, 1): p.append(caja(0.16, 2.5, 0.2, (sx * 1.15, 0, h - 0.1), color=MADERA, tono=0.15, semilla=6 + sx))
    if _L[0] < 2:
        for sx in (-1, 1):
            for sy in (-1, 1):
                p.append(caja(0.1, 0.1, 0.8, (sx * 0.88, sy * 1.15, h - 0.42), (0, sx * 0.785, 0), color=MADERA, tono=0.15, semilla=8))
    n = N(6, 2, 1)
    for i in range(n):
        w = 2.2 / n
        p.append(caja(w - 0.02, 0.05, 1.3, (-1.1 + (i + 0.5) * w, 1.18, 0.6), color=hexlin(MADERA_GRIS) * (0.85 + 0.25 * ((i * 7) % 3) / 2), tono=0.15, semilla=10 + i))
    return acabar(p, 'cobertizo', base=0.3, musgo=0.15)


@pieza('cobertizo_techo', (560, 170, 30), ao_dist=1.6)
def cobertizo_techo():
    """Tejado a dos aguas (2,7 × 2,75 × 3,3): faldones de tablilla en hiladas, cumbrera y tímpanos de tabla."""
    p = []; W, D, H = 1.38, 1.4, 3.2
    ang = math.atan2(H - 0.15, W)
    L = math.hypot(W, H - 0.15)
    filas = N(4, 2, 1)
    for s in (-1, 1):
        for k in range(filas):
            t0 = k / filas; t1 = (k + 1) / filas
            c = ((t0 + t1) / 2)
            x = s * W * (1 - c); z = 0.15 + (H - 0.15) * c
            o = caja(L / filas + 0.12, 2 * D, 0.07, (x + s * 0.02 * (filas - k) / filas, 0, z + 0.03), (0, s * ang, 0), marca='madera', color=hexlin(MADERA_OSC) * (0.9 + 0.2 * ((k * 3) % 2)), bisel=0.015, tono=0.22, semilla=k + (5 if s > 0 else 0))
            p.append(o)
    for y in (-D + 0.06, D - 0.06):
        o = malla('timpano', [(-W + 0.12, y, 0.15), (W - 0.12, y, 0.15), (0, y, H - 0.1)], [(0, 1, 2)], 'madera', MADERA_GRIS)
        dos_caras(o); variar(o, 0.2, 2.0, 3); p.append(o)
    p.append(caja(0.16, 2 * D + 0.1, 0.16, (0, 0, H + 0.02), color=MADERA_OSC, bisel=0.02))
    if _L[0] == 0:
        for y in (-D - 0.03, D + 0.03):
            for s in (-1, 1): p.append(caja(0.07, 0.07, L * 0.42, (s * 0.2, y, H - 0.25), (0, s * (math.pi / 2 - ang) * -1 + s * 0.5, 0), color=MADERA_OSC))
    return acabar(p, 'cobertizo_techo', base=0.0, musgo=0.35, z_musgo=0.0)


# ── herramientas ──
@pieza('hacha', (110, 36, 12), ao_dist=0.4)
def hacha():
    """Hacha de leñador de pie (0,55 × 0,15 × 1,3)."""
    p = [palo((0, 0, 0.0), (0, 0, 1.25), 0.03, MADERA_CLARA, 2, punta=False)]
    o = malla('hoja', [(0.02, -0.025, 1.02), (0.3, -0.012, 0.92), (0.3, -0.012, 1.24), (0.02, -0.025, 1.18), (0.02, 0.025, 1.02), (0.3, 0.012, 0.92), (0.3, 0.012, 1.24), (0.02, 0.025, 1.18)],
              [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], 'liso', HIERRO_CLARO)
    pintar_fn(o, lambda P, Nn, C: np.where((P[:, 0] > 0.25)[:, None], hexlin('#9a9aa0'), C)); p.append(o)
    p.append(caja(0.1, 0.07, 0.2, (-0.03, 0, 1.1), marca='liso', color=HIERRO))
    return acabar(p, 'hacha', base=0.0, ang=35)


@pieza('pico', (110, 44, 12), ao_dist=0.4)
def pico():
    """Pico de minero de pie (0,9 × 0,2 × 1,2)."""
    p = [palo((0, 0, 0.0), (0, 0, 1.15), 0.03, MADERA_CLARA, 3, punta=False)]
    p.append(tubo(curva([(-0.45, 0, 1.0), (-0.2, 0, 1.12), (0, 0, 1.15), (0.2, 0, 1.12), (0.45, 0, 1.0)], N(7, 5, 3)), 0.032, 4, 'pico', 'liso', HIERRO, punta=False))
    return acabar(p, 'pico', base=0.0, ang=35)


@pieza('pala', (110, 30, 12), ao_dist=0.4)
def pala():
    """Pala clavada en la tierra (0,35 × 0,15 × 1,45)."""
    p = [palo((0, 0, 0.35), (0, 0, 1.38), 0.028, MADERA_CLARA, 4, punta=False)]
    p.append(caja(0.22, 0.03, 0.05, (0, 0, 1.38), marca='madera', color=MADERA))
    o = malla('pala', [(-0.15, 0, 0.0), (0.15, 0, 0.0), (0.16, 0, 0.32), (0.04, 0, 0.42), (-0.04, 0, 0.42), (-0.16, 0, 0.32)], [(0, 1, 2, 3, 4, 5)], 'liso', HIERRO_CLARO)
    dos_caras(o); mover(o, (0, 0, -0.05)); p.append(o)
    return acabar(p, 'pala', base=0.0, ang=35)


# ── troncos y tocones ──
def _tronco(largo, r, semilla, color=MADERA):
    n = N(6, 3, 2)
    pts = [(0, -largo / 2 + largo * i / n, r * 0.92) for i in range(n + 1)]
    rad = [r * (1.0 - 0.12 * i / n) for i in range(n + 1)]
    o = tubo(pts, rad, N(9, 7, 5), 'tronco', 'madera', color, punta=False, tapa_base=True)
    if _L[0] < 2: desplazar(o, r * 0.08, 2.0 / r, semilla)
    # tapa del final (el corte claro con anillos)
    rng = azar(semilla)
    tapa = torno([(0, 0), (rad[-1] * 0.98, 0)], N(9, 7, 5), 'liso', CORTE)
    mover(tapa, (0, 0, 0), (-math.pi / 2, 0, 0)); mover(tapa, (0, largo / 2, r * 0.92))
    dos_caras(tapa)
    pintar_fn(tapa, lambda P, Nn, C: C * (0.8 + 0.25 * np.sin(np.hypot(P[:, 0], P[:, 2] - r * 0.92) * 40 / r))[:, None])
    pintar_fn(o, lambda P, Nn, C: np.where((np.abs(Nn[:, 1]) > 0.8)[:, None], hexlin(CORTE) * 0.9, C))
    variar(o, 0.22, 1.5 / r, semilla + 1, estirar=(1, 0.2, 1))
    return [o, tapa]


@pieza('tronco', (300, 90, 24), ao_dist=1.0)
def tronco():
    """Tronco tumbado (1,25 × 5 × 1,25): corteza con nudos, cortes claros y musgo encima."""
    p = _tronco(4.9, 0.6, 3)
    o = unir(p, 'tronco')
    manchar(o, MUSGO, lambda P, Nn: Nn[:, 2] * 1.1 - 0.2, 0.75, 1.0, 4)
    desgastar(o, 0.25, 0.3)
    return suavizar(o, 50)


@pieza('tocon', (300, 127, 30), ao_dist=0.9)
def tocon():
    """Tocon talado (1 × 1 × 1,3): corte en bisel, raices que se hunden y astillas."""
    p = []
    o = torno([(0.52, -0.3), (0.5, 0.15), (0.42, 0.6), (0.38, 1.1), (0.3, 1.3), (0, 1.22)] if _L[0] < 2 else [(0.5, -0.3), (0.38, 1.1), (0, 1.25)], N(9, 7, 5), 'madera', MADERA)
    deformar(o, lambda P: np.stack([P[:, 0], P[:, 1], np.where(P[:, 2] > 1.0, 1.0 + (P[:, 2] - 1.0) * (0.5 + 0.9 * (P[:, 0] + 0.4)), P[:, 2])], 1))
    if _L[0] < 2: desplazar(o, 0.04, 3.0, 2)
    pintar_fn(o, lambda P, Nn, C: np.where((Nn[:, 2] > 0.6)[:, None] & (P[:, 2] > 0.95)[:, None], hexlin(CORTE) * (0.85 + 0.2 * np.sin(np.hypot(P[:, 0], P[:, 1]) * 40))[:, None], C))
    p.append(o)
    if _L[0] < 2:
        for k in range(N(4, 3, 0)):
            a = k * math.pi / 2 + 0.4
            p.append(tubo([(math.cos(a) * 0.3, math.sin(a) * 0.3, 0.35), (math.cos(a) * 0.62, math.sin(a) * 0.62, 0.05), (math.cos(a) * 0.8, math.sin(a) * 0.8, -0.2)], [0.16, 0.1, 0.04], N(5, 4, 3), 'raiz', 'madera', MADERA_OSC))
    o = unir(p, 'tocon')
    variar(o, 0.2, 2.0, 5)
    manchar(o, MUSGO, lambda P, Nn: np.clip(0.5 - P[:, 2], 0, 1) * 1.6, 0.7, 2.0, 6)
    desgastar(o, 0.3, 0.3)
    return suavizar(o, 45)


# ── mesas de trabajo ──
def _mesa_basica(W, D, H, semilla):
    p = tablas(3, W, D, 0.08, (0, 0, H - 0.04), eje='x', color=MADERA_CLARA, semilla=semilla)
    for sx in (-1, 1):
        for sy in (-1, 1): p.append(caja(0.1, 0.1, H - 0.08, (sx * (W / 2 - 0.1), sy * (D / 2 - 0.1), (H - 0.08) / 2), color=MADERA_OSC, tono=0.15, semilla=semilla + 3))
    if _L[0] < 2:
        for sy in (-1, 1): p.append(caja(W - 0.2, 0.06, 0.08, (0, sy * (D / 2 - 0.1), 0.25), color=MADERA_OSC))
    return p


@pieza('banco_trabajo', (460, 171, 40), ao_dist=1.0)
def banco_trabajo():
    """Banco de carpintero (1,6 × 1,45 × 1,4): sierra, garlopa, mazo y un tornillo de banco."""
    p = _mesa_basica(1.55, 0.95, 0.95, 20)
    if _L[0] < 2:
        p.append(caja(0.12, 0.3, 0.18, (0.62, -0.38, 1.0), color=MADERA_OSC))
        p.append(caja(0.35, 0.1, 0.12, (-0.3, 0.1, 1.0), color=MADERA, bisel=0.02))
        p.append(caja(0.5, 0.18, 0.012, (0.15, -0.2, 0.96), marca='liso', color=HIERRO_CLARO))
        p.append(caja(0.12, 0.05, 0.05, (-0.12, -0.2, 0.96), color=MADERA_OSC))
        p.append(palo((-0.6, 0.2, 0.96), (-0.2, 0.2, 0.96), 0.025, MADERA_CLARA, 4, punta=False))
        p.append(caja(0.14, 0.12, 0.12, (-0.62, 0.2, 0.98), color=MADERA_OSC))
        p.append(caja(0.9, 0.04, 0.6, (0, 0.47, 1.3), color=MADERA_GRIS, tono=0.15))
    return acabar(p, 'banco_trabajo', base=0.3)


@pieza('yunque', (520, 253, 40), ao_dist=1.0)
def yunque():
    """Yunque de herrero sobre un tocon (1,6 × 1,5 × 1,7), con su martillo, tenazas y la tina de templar."""
    p = []
    t = torno([(0.42, -0.2), (0.4, 0.75), (0, 0.76)], N(9, 7, 5), 'madera', MADERA, loc=(0.2, 0, 0)); variar(t, 0.2, 3, 2); p.append(t)
    # el yunque: cuerpo, cintura, mesa y bigornia
    p.append(caja(0.5, 0.36, 0.14, (0.2, 0, 0.83), marca='liso', color=HIERRO, bisel=0.02))
    p.append(caja(0.3, 0.22, 0.18, (0.2, 0, 0.98), marca='liso', color=HIERRO))
    p.append(caja(0.62, 0.3, 0.14, (0.2, 0, 1.13), marca='liso', color=HIERRO_CLARO, bisel=0.02))
    b = torno([(0.11, 0), (0.0, 0.34)], N(7, 5, 4), 'liso', HIERRO_CLARO); mover(b, rot=(0, -math.pi / 2, 0)); mover(b, (0.2 - 0.31, 0, 1.15)); p.append(b)
    if _L[0] < 2:
        p.append(palo((0.3, -0.05, 1.21), (0.55, -0.2, 1.21), 0.02, MADERA_CLARA, 3, punta=False))
        p.append(caja(0.1, 0.06, 0.06, (0.27, -0.03, 1.22), marca='liso', color=HIERRO))
        p.append(mover(_barril(0.6, 0.34, 6, tapa=False), (-0.5, 0.3, 0)))
        p.append(torno([(0.3, 0.52), (0, 0.52)], N(10, 7, 5), 'liso', '#20302e', loc=(-0.5, 0.3, 0)))
        p.append(palo((-0.45, 0.3, 0.4), (-0.38, 0.1, 1.05), 0.015, HIERRO, 5, punta=False, marca='liso'))
    return acabar(p, 'yunque', base=0.3)


@pieza('muela', (480, 223, 40), ao_dist=1.0)
def muela():
    """Muela de afilar (1,3 × 1,65 × 1,4): rueda de piedra en un bastidor, manivela y artesa de agua."""
    p = []
    for sy in (-1, 1):
        for sx in (-1, 1): p.append(caja(0.09, 0.09, 0.8, (sx * 0.45, sy * 0.7, 0.4), (sx * 0.12, 0, 0), color=MADERA_OSC, tono=0.15))
        p.append(caja(1.0, 0.1, 0.1, (0, sy * 0.7, 0.78), color=MADERA))
    for sx in (-1, 1): p.append(caja(0.1, 1.5, 0.1, (sx * 0.4, 0, 0.84), color=MADERA, bisel=0.015))
    r = torno([(0.0, -0.08), (0.48, -0.08), (0.5, -0.05), (0.5, 0.05), (0.48, 0.08), (0.0, 0.08)] if _L[0] < 2 else [(0, -0.08), (0.5, -0.08), (0.5, 0.08), (0, 0.08)], N(14, 10, 6), 'monolito', PIEDRA)
    mover(r, rot=(0, math.pi / 2, 0)); mover(r, (0, 0, 1.0)); variar(r, 0.2, 3.0, 2); p.append(r)
    p.append(barra((-0.5, 0, 1.0), (0.55, 0, 1.0), 0.025, 5, 'liso', HIERRO))
    if _L[0] < 2:
        p.append(barra((0.55, 0, 1.0), (0.55, 0, 1.25), 0.02, 4, 'liso', HIERRO))
        p.append(palo((0.55, 0, 1.25), (0.75, 0, 1.25), 0.025, MADERA_CLARA, 2, punta=False))
        p.append(caja(0.3, 0.5, 0.2, (0, 0, 0.5), color=MADERA_GRIS))
    return acabar(p, 'muela', base=0.3)


# ═══════════════ CAMPOSANTO: panteon, cripta y santuario ═══════════════
@pieza('altar', (480, 140, 40), ao_dist=1.2)
def altar():
    """Altar de piedra (2,5 × 1,55 × 1,17): losa gruesa sobre dos pedestales, runa violeta grabada al frente."""
    p = [caja(2.4, 1.45, 0.3, (0, 0, 1.02), marca='monolito', color=PIEDRA_CLARA, bisel=0.05, tono=0.2, semilla=1)]
    for sx in (-1, 1):
        p.append(caja(0.62, 1.15, 0.85, (sx * 0.78, 0, 0.42), marca='monolito', color=PIEDRA, bisel=0.04, tono=0.2, semilla=2 + sx))
        p.append(caja(0.78, 1.3, 0.12, (sx * 0.78, 0, 0.0), marca='monolito', color=PIEDRA_OSC, bisel=0.03))
    p.append(caja(0.95, 0.9, 0.6, (0, 0.05, 0.4), marca='monolito', color=PIEDRA_OSC))
    if _L[0] < 2: p.append(runa((0, -0.74, 1.02), 0.3, 0.22, VIOLETA, grosor=0.012))
    if _L[0] == 0: p.append(torno([(0.3, 1.17), (0.26, 1.2), (0, 1.21)], 10, 'liso', '#3a1a24', loc=(0.5, 0.1, 0)))
    return acabar(p, 'altar', musgo=0.45, z_musgo=0.3, base=0.25)


@pieza('banco_piedra', (240, 70, 20), ao_dist=0.9)
def banco_piedra():
    """Banco de piedra con respaldo (1,95 × 1,1 × 1,25), con una esquina rota."""
    p = [caja(1.9, 0.6, 0.14, (0, -0.1, 0.5), marca='monolito', color=PIEDRA_CLARA, bisel=0.03, tono=0.2, semilla=1)]
    for sx in (-1, 1): p.append(caja(0.25, 0.55, 0.45, (sx * 0.7, -0.1, 0.22), marca='monolito', color=PIEDRA, bisel=0.03, tono=0.2, semilla=2 + sx))
    r = caja(1.8, 0.16, 0.7, (0, 0.28, 0.88), (-0.12, 0, 0), marca='monolito', color=PIEDRA, bisel=0.03, tono=0.2, semilla=4)
    if _L[0] < 2: deformar(r, lambda P: P - np.stack([np.zeros(len(P)), np.zeros(len(P)), np.clip(P[:, 2] - 0.95, 0, None) * 0.7 * np.clip((P[:, 0] - 0.55) * 3, 0, 1)], 1))
    p.append(r)
    return acabar(p, 'banco_piedra', musgo=0.5, z_musgo=0.3)


@pieza('pilar_reja', (240, 70, 16), ao_dist=0.8)
def pilar_reja():
    """Machon de la reja (0,55 × 0,55 × 1,82): sillares, cornisa y bola de remate."""
    p = [caja(0.5, 0.5, 0.3, (0, 0, 0.12), marca='monolito', color=PIEDRA_OSC, bisel=0.03)]
    n = N(3, 1, 1)
    for k in range(n):
        h = 1.2 / n
        p.append(caja(0.42 - 0.02 * (k % 2), 0.42 - 0.02 * (k % 2), h - 0.02 * (n > 1), (0, 0, 0.27 + (k + 0.5) * h), marca='monolito', color=hexlin(PIEDRA) * (0.9 + 0.12 * (k % 2)), tono=0.15, semilla=k))
    p.append(caja(0.55, 0.55, 0.1, (0, 0, 1.5), marca='monolito', color=PIEDRA_CLARA, bisel=0.02))
    p.append(esfera((0, 0, 1.68), 0.15, N(2, 1, 1), marca='monolito', color=PIEDRA_CLARA))
    return acabar(p, 'pilar_reja', musgo=0.5, z_musgo=0.25)


@pieza('vela', (110, 70, 12), ao_dist=0.3)
def vela():
    """Vela gruesa en su plato (0,33 × 0,48), con la llama."""
    p = [torno([(0.16, 0), (0.16, 0.03), (0.1, 0.035), (0, 0.035)], N(8, 6, 5), 'liso', HIERRO)]
    p.append(torno([(0.08, 0.03), (0.08, 0.3), (0.07, 0.32), (0, 0.32)] if _L[0] < 2 else [(0.08, 0.03), (0.075, 0.32), (0, 0.32)], N(7, 5, 4), 'liso', '#d8ccb0'))
    if _L[0] < 2: p.append(torno([(0.03, 0.33), (0.02, 0.41), (0, 0.47)], 4, 'emisivo', LLAMA))
    return acabar(p, 'vela', base=0.0, guardar=('emisivo', 'liso'))


@pieza('velas', (260, 106, 20), ao_dist=0.3)
def velas():
    """Corro de velas derretidas (0,6 × 0,64 × 0,48) sobre un charco de cera."""
    rng = azar(7); p = [torno([(0.28, 0), (0.24, 0.03), (0, 0.04)], N(9, 7, 5), 'liso', '#cfc2a2')]
    for i in range(N(5, 3, 2)):
        a = i * 2.4; d = 0.15 if i else 0.0; h = rng.uniform(0.18, 0.34) if i else 0.36; r = rng.uniform(0.04, 0.06)
        c = (math.cos(a) * d, math.sin(a) * d, 0)
        p.append(torno([(r, 0.02), (r * 1.05, h), (0, h + 0.01)], N(6, 5, 4), 'liso', hexlin('#d8ccb0') * rng.uniform(0.85, 1.05), loc=c))
        if _L[0] < 2: p.append(torno([(0.022, h + 0.01), (0.014, h + 0.06), (0, h + 0.11)], 4, 'emisivo', LLAMA, loc=c))
    return acabar(p, 'velas', base=0.0, guardar=('emisivo', 'liso'))


@pieza('columna', (480, 190, 30), ao_dist=1.0)
def columna():
    """Columna antigua (0,95 × 2,7): basa, fuste agrietado con musgo y capitel de dos molduras."""
    p = [caja(0.94, 0.94, 0.2, (0, 0, 0.06), marca='monolito', color=PIEDRA_OSC, bisel=0.03)]
    p.append(torno([(0.42, 0.15), (0.4, 0.24), (0.36, 0.28), (0, 0.28)], N(14, 10, 6), 'monolito', PIEDRA_CLARA))
    f = torno([(0.36, 0.26), (0.34, 0.4), (0.33, 1.3), (0.31, 2.36)] if _L[0] < 2 else [(0.36, 0.26), (0.31, 2.36)], N(14, 10, 6), 'monolito', PIEDRA)
    if _L[0] < 2: desplazar(f, 0.015, 3.0, 3)
    p.append(f)
    p.append(torno([(0.32, 2.34), (0.42, 2.46), (0.42, 2.52), (0, 2.52)], N(14, 10, 6), 'monolito', PIEDRA_CLARA))
    p.append(caja(0.9, 0.9, 0.18, (0, 0, 2.6), marca='monolito', color=PIEDRA, bisel=0.03))
    o = unir(p, 'columna')
    variar(o, 0.2, 1.6, 4); variar(o, 0.1, 6.0, 5, tono=PIEDRA_OSC)
    manchar(o, MUSGO, lambda P, Nn: Nn[:, 2] * 0.8 + np.clip(0.9 - P[:, 2], 0, 1) * 0.9, 0.85, 2.5, 5)
    desgastar(o, 0.35, 0.3)
    return suavizar(o, 40)


@pieza('pilar', (300, 99, 16), ao_dist=0.9)
def pilar():
    """Pilar cuadrado (0,84 × 2,76) con un friso de runas verdes que brillan de noche."""
    p = [caja(0.84, 0.84, 0.22, (0, 0, 0.06), marca='monolito', color=PIEDRA_OSC, bisel=0.03),
         caja(0.66, 0.66, 2.2, (0, 0, 1.25), marca='monolito', color=PIEDRA, bisel=0.03, tono=0.18, semilla=2),
         caja(0.8, 0.8, 0.2, (0, 0, 2.62), marca='monolito', color=PIEDRA_CLARA, bisel=0.03)]
    if _L[0] < 2:
        for k in range(N(2, 1, 0)):
            a = k * math.pi
            p.append(runa((math.sin(a) * 0.335, -math.cos(a) * 0.335, 1.85), 0.26, 0.3, VERDE_RUNA, rot=(0, 0, a), grosor=0.012))
    return acabar(p, 'pilar', musgo=0.45, z_musgo=0.4)


@pieza('obelisco', (200, 87, 14), ao_dist=0.9)
def obelisco():
    """Obelisco (0,84 × 2,43): aguja de piedra de una pieza con una runa violeta."""
    p = [caja(0.84, 0.84, 0.25, (0, 0, 0.08), marca='monolito', color=PIEDRA_OSC, bisel=0.03)]
    o = torno([(0.33, 0.2), (0.22, 2.1), (0, 2.43)], 4, 'monolito', PIEDRA, fase=math.pi / 4)
    p.append(o)
    if _L[0] < 2: p.append(runa((0, -0.3, 1.1), 0.22, 0.32, VIOLETA, rot=(-0.06, 0, 0), grosor=0.012))
    return acabar(p, 'obelisco', musgo=0.4, z_musgo=0.4)


@pieza('cripta', (1400, 300, 90), ao_dist=2.0)
def cripta():
    """Mausoleo (4,45 × 5,75 × 2,4; el tejado va aparte): hiladas de sillares, pilastras, portada con la reja
    entreabierta, escalones y una runa violeta en el dintel."""
    W, D, H = 2.22, 2.88, 2.4; p = []
    hil = N(4, 2, 1); rng = azar(21); GRIS = '#8b8983'
    for k in range(hil):
        h = (H - 0.25) / hil; z = 0.25 + (k + 0.5) * h
        p.append(caja(2 * W - 0.5 - 0.04 * (k % 2), 2 * D - 0.5, h - 0.03 * (hil > 2), (0, 0.1, z), marca='monolito', color=hexlin(GRIS) * rng.uniform(0.85, 1.1), tono=0.15, semilla=k))
        if _L[0] == 0:   # sillares de la fachada y de los costados: bloques sueltos con su llaga
            for sx in (-1, 1):
                nb = 4; L = (2 * D - 1.2) / nb; off = 0.5 * L * (k % 2)
                for b in range(nb):
                    y0 = -D + 0.6 + b * L + off; y1 = min(D - 0.4, y0 + L)
                    if y1 - y0 > 0.2: p.append(caja(0.06, y1 - y0 - 0.04, h - 0.04, (sx * (W - 0.25 + 0.03), 0.1 + (y0 + y1) / 2 - 0.1, z), marca='monolito', color=hexlin(GRIS) * rng.uniform(0.8, 1.15), semilla=k * 9 + b))
            for b in range(3):   # fachada, a los lados de la portada
                for s in (-1, 1): p.append(caja(0.34, 0.06, h - 0.04, (s * (W - 0.5 - b * 0.38 - 0.17 - 0.12 * (k % 2)), -D + 0.32, z), marca='monolito', color=hexlin(GRIS) * rng.uniform(0.8, 1.15), semilla=k * 7 + b + (s > 0) * 3))
    p.append(caja(2 * W, 2 * D, 0.3, (0, 0, 0.1), marca='monolito', color=PIEDRA_OSC, bisel=0.04))
    for sx in (-1, 1):
        for sy in (-1, 1): p.append(caja(0.42, 0.42, H - 0.2, (sx * (W - 0.32), sy * (D - 0.35) + 0.1, H / 2 + 0.05), marca='monolito', color=PIEDRA_CLARA, bisel=0.03, tono=0.15, semilla=3))
    p.append(caja(2 * W - 0.1, 2 * D - 0.2, 0.18, (0, 0.1, H - 0.08), marca='monolito', color=PIEDRA_CLARA, bisel=0.03))
    p.append(caja(1.5, 0.3, 1.95, (0, -D + 0.38, 1.12), marca='monolito', color=PIEDRA_CLARA, bisel=0.03))
    p.append(caja(1.0, 0.1, 1.5, (0, -D + 0.22, 0.95), marca='liso', color='#141216'))
    if _L[0] < 2:
        p.append(caja(0.48, 0.04, 1.4, (-0.24, -D + 0.16, 0.92), marca='liso', color=HIERRO_CLARO))
        p.append(caja(0.48, 0.04, 1.4, (0.3, -D + 0.08, 0.92), (0, 0, -0.35), marca='liso', color=HIERRO_CLARO))
        p.append(runa((0, -D + 0.22, 1.86), 0.4, 0.22, VIOLETA, grosor=0.014))
        for sx in (-1, 1):
            for y in (-0.8, 0.9): p.append(caja(0.06, 0.18, 0.5, (sx * (W - 0.25), y, 1.45), marca='liso', color='#141216'))
    for k in range(N(3, 2, 1)):
        p.append(caja(1.6 + 0.3 * k, 0.32, 0.12, (0, -D - 0.1 - 0.3 * k, 0.24 - 0.11 * k), marca='monolito', color=hexlin(PIEDRA_OSC) * (1.0 + 0.08 * k), bisel=0.02))
    return acabar(p, 'cripta', musgo=0.5, z_musgo=0.5, base=0.3)


@pieza('cripta_techo', (520, 160, 40), ao_dist=1.6)
def cripta_techo():
    """Tejado del mausoleo (4,75 × 5,85 × 1,8): losas a dos aguas, frontones con óculo y pináculos."""
    W, D, H = 2.37, 2.92, 1.75; p = []
    ang = math.atan2(H - 0.35, W); L = math.hypot(W, H - 0.35)
    for s in (-1, 1):
        filas = N(3, 1, 1)
        for k in range(filas):
            c = (k + 0.5) / filas
            p.append(caja(L / filas + 0.08, 2 * D, 0.16, (s * W * (1 - c), 0, 0.3 + (H - 0.35) * c), (0, s * ang, 0), marca='monolito', color=hexlin(PIEDRA_OSC) * (0.92 + 0.1 * k), bisel=0.03, tono=0.2, semilla=k + 3 * (s > 0)))
    for y in (-D + 0.1, D - 0.1):
        o = malla('fronton', [(-W + 0.1, y, 0.2), (W - 0.1, y, 0.2), (0, y, H - 0.05)], [(0, 1, 2)], 'monolito', PIEDRA)
        dos_caras(o); p.append(o)
    p.append(caja(0.22, 2 * D + 0.1, 0.18, (0, 0, H + 0.05), marca='monolito', color=PIEDRA_CLARA, bisel=0.03))
    if _L[0] < 2:
        oc = torno([(0.26, 0), (0.26, 0.06), (0, 0.06)], N(10, 8, 6), 'liso', '#141216')
        mover(oc, rot=(math.pi / 2, 0, 0)); mover(oc, (0, -D + 0.14, 0.85)); p.append(oc)
        for y in (-D + 0.1, D - 0.1):
            p.append(torno([(0.14, H - 0.05), (0.11, H + 0.25), (0, H + 0.5)], 4, 'monolito', PIEDRA_CLARA, loc=(0, y, 0)))
            for sx in (-1, 1): p.append(torno([(0.12, 0.2), (0.1, 0.45), (0, 0.7)], 4, 'monolito', PIEDRA_CLARA, loc=(sx * (W - 0.2), y, 0)))
    return acabar(p, 'cripta_techo', musgo=0.7, z_musgo=0.0, base=0.0)


@pieza('brasero', (330, 209, 30), ao_dist=0.8)
def brasero():
    """Brasero de hierro (1 × 1 × 0,4): cuenco bajo sobre tres patas con brasas."""
    p = [torno([(0.3, 0.12), (0.46, 0.22), (0.5, 0.36), (0.46, 0.36), (0.42, 0.25), (0.28, 0.17), (0, 0.17)], N(12, 8, 6), 'liso', HIERRO)]
    for k in range(3):
        a = k * 2 * math.pi / 3
        p.append(barra((math.cos(a) * 0.32, math.sin(a) * 0.32, 0.17), (math.cos(a) * 0.42, math.sin(a) * 0.42, -0.05), 0.03, 4, 'liso', HIERRO))
    p += brasas(0.36, 0.2, 5, llamas=True)
    return acabar(p, 'brasero', base=0.0)


@pieza('tumba', (220, 104, 14), ao_dist=0.6)
def tumba():
    """Tumba de tierra (1,75 × 3 × 0,27): montículo removido con piedras sueltas."""
    o = masa([(0, 0, -0.05, 0.75, 1.35, 0.32), (0.1, 0.5, -0.05, 0.6, 0.7, 0.3)], voxel=0.12, tris=N(160, 60, 14), ruido_f=0.05, ruido_e=3.0, semilla=2, marca='liso', inflado=0.1)
    pintar(o, TIERRA); variar(o, 0.3, 3.0, 2, tono='#3a2e22')
    manchar(o, '#3c4a26', lambda P, Nn: np.clip(0.05 - P[:, 2], 0, 1) * 8, 0.8, 3.0, 3)
    p = [o]
    if _L[0] < 2:
        for i in range(N(3, 2, 0)): p.append(piedra_suelta(0.1, (0.4 * (i - 1), -0.9 + 0.7 * i, 0.12), i, PIEDRA_OSC))
    return acabar(p, 'tumba', base=0.0, luz=0.2, sombra=0.2)


@pieza('tumba_borde', (300, 90, 20), ao_dist=0.6)
def tumba_borde():
    """Tumba con bordillo (1,85 × 3,3 × 0,27): losas de borde, grava y una losa rota encima."""
    p = []
    for sx in (-1, 1): p.append(caja(0.16, 3.2, 0.22, (sx * 0.84, 0, 0.08), marca='monolito', color=PIEDRA, bisel=0.02, tono=0.15, semilla=1 + sx))
    for sy in (-1, 1): p.append(caja(1.52, 0.16, 0.22, (0, sy * 1.52, 0.08), marca='monolito', color=PIEDRA, bisel=0.02))
    g = caja(1.52, 2.88, 0.12, (0, 0, 0.06), marca='liso', color='#5c574f')
    if _L[0] == 0: subdividir(g, 1, simple=True); desplazar(g, 0.02, 9.0, 3, eje=(0, 0, 1))
    variar(g, 0.35, 9.0, 4); p.append(g)
    if _L[0] < 2: p.append(caja(0.9, 0.7, 0.08, (0.15, 0.8, 0.14), (0.05, -0.04, 0.2), marca='monolito', color=PIEDRA_CLARA, bisel=0.02))
    return acabar(p, 'tumba_borde', musgo=0.4, z_musgo=0.25, base=0.1)


def _lapida(contorno, grosor, inclina=0.0):
    """Lapida extruida desde su contorno (x, z), con el canto biselado en el nivel alto."""
    n = len(contorno)
    verts = [(x, -grosor / 2, z) for x, z in contorno] + [(x, grosor / 2, z) for x, z in contorno]
    caras = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    o = malla('lapida', verts, caras, 'monolito', PIEDRA_CLARA)
    if _L[0] == 0: biselar(o, 0.025, 1)
    mover(o, rot=(inclina, 0, 0))
    return o


def _acabar_lapida(p, nombre, semilla):
    o = unir(p, nombre)
    variar(o, 0.2, 2.0, semilla); variar(o, 0.12, 7.0, semilla + 1, tono=PIEDRA_OSC)
    manchar(o, MUSGO, lambda P, Nn: Nn[:, 2] * 0.9 + np.clip(0.45 - P[:, 2], 0, 1) * 1.6, 0.85, 3.0, semilla + 2)
    desgastar(o, 0.35, 0.3)
    return suavizar(o, 40)


def _arco(r, n, z0):
    return [(math.cos(math.pi * i / n) * r, z0 + math.sin(math.pi * i / n) * r) for i in range(n + 1)]


@pieza('lapida_redonda', (180, 50, 14), ao_dist=0.6)
def lapida_redonda():
    """Lapida de medio punto (1,1 × 0,6 × 1,4), un poco ladeada, con su runa tallada."""
    c = [(0.42, -0.3)] + _arco(0.42, N(8, 5, 3), 0.92) + [(-0.42, -0.3)]
    p = [_lapida(c, 0.16, 0.06), caja(0.6, 0.35, 0.12, (0, 0, 0.0), marca='monolito', color=PIEDRA_OSC)]
    if _L[0] == 0:
        r = runa((0, -0.08, 0.85), 0.18, 0.2, '#57534d', grosor=0.012); marcar(r, 'monolito'); p.append(r)
    return _acabar_lapida(p, 'lapida_redonda', 3)


@pieza('lapida_cruz', (240, 70, 14), ao_dist=0.7)
def lapida_cruz():
    """Cruz de piedra (1,1 × 0,8 × 2,2) sobre un zócalo escalonado."""
    a, b = 0.13, 0.45
    c = [(a, -0.2), (a, 1.45), (b, 1.45), (b, 1.71), (a, 1.71), (a, 2.05), (-a, 2.05), (-a, 1.71), (-b, 1.71), (-b, 1.45), (-a, 1.45), (-a, -0.2)]
    p = [_lapida(c, 0.22, -0.04), caja(0.7, 0.55, 0.22, (0, 0, 0.08), marca='monolito', color=PIEDRA_OSC, bisel=0.02)]
    if _L[0] < 2: p.append(caja(0.52, 0.4, 0.14, (0, 0, 0.25), marca='monolito', color=PIEDRA, bisel=0.02))
    return _acabar_lapida(p, 'lapida_cruz', 4)


@pieza('lapida_ancha', (200, 60, 14), ao_dist=0.7)
def lapida_ancha():
    """Lapida doble (2 × 0,7 × 1,37) con dos arcos sobre un pedestal."""
    n = N(5, 3, 2)
    c = [(0.95, -0.3), (0.95, 0.85)] + [(x + 0.475, z) for x, z in _arco(0.47, n, 0.85)][1:] + [(x - 0.475, z) for x, z in _arco(0.47, n, 0.85)][1:] + [(-0.95, -0.3)]
    p = [_lapida(c, 0.2, 0.03), caja(2.04, 0.5, 0.15, (0, 0, 0.0), marca='monolito', color=PIEDRA_OSC, bisel=0.02)]
    return _acabar_lapida(p, 'lapida_ancha', 6)


@pieza('lapida_rota', (200, 60, 16), ao_dist=0.6)
def lapida_rota():
    """Lapida partida (1,2 × 0,95 × 0,8): el pie clavado y el trozo de arriba caido al lado."""
    c = [(0.42, -0.3), (0.42, 0.55), (0.2, 0.72), (0.05, 0.6), (-0.15, 0.78), (-0.42, 0.5), (-0.42, -0.3)]
    p = [_lapida(c, 0.16, 0.1)]
    t = _lapida([(0.42, 0), (0.42, 0.25)] + _arco(0.42, N(6, 4, 2), 0.25)[1:] + [(-0.42, 0)], 0.15)
    mover(t, rot=(-math.pi / 2 + 0.1, 0, 0.5)); mover(t, (0.15, -0.35, 0.06)); p.append(t)
    return _acabar_lapida(p, 'lapida_rota', 9)


def _reja(rota=False):
    """Tramo de reja de hierro (2,4 de ancho) sobre un bordillo de piedra: barrotes con lanza y dos travesaños."""
    p = [caja(2.4, 0.3, 0.22, (0, 0, 0.06), marca='monolito', color=PIEDRA, bisel=0.02, tono=0.15, semilla=1)]
    H = 1.75
    if _L[0] == 2:
        p.append(lamina(lambda u, v: (-1.15 + 2.3 * u, 0, 0.17 + (H - 0.17) * v), 1, 1, 'liso', HIERRO))
        return p
    n = 9
    for i in range(n):
        x = -1.08 + i * 2.16 / (n - 1)
        if rota and i in (5, 6): continue
        top = H + (0.08 if i % 2 else 0)
        dob = (rota and i in (4, 7)) * 0.25
        a, b = (x, 0, 0.17), (x + dob * 0.5, -dob, top)
        p.append(barra(a, b, 0.022, 4, 'liso', HIERRO))
        if _L[0] == 0 or i % 2 == 0: p.append(torno([(0.045, 0), (0, 0.16)], 4, 'liso', HIERRO, loc=b))
    for z in (0.4, H - 0.15):
        if rota:
            p.append(barra((-1.18, 0, z), (0.2, 0, z), 0.025, 4, 'liso', HIERRO))
            p.append(barra((0.75, 0, z), (1.18, 0, z), 0.025, 4, 'liso', HIERRO))
        else:
            p.append(barra((-1.18, 0, z), (1.18, 0, z), 0.025, 4, 'liso', HIERRO))
    if rota: p.append(barra((0.2, 0, 0.4), (0.6, -0.45, 0.05), 0.025, 4, 'liso', HIERRO))
    return p


def _acabar_reja(p, nombre):
    o = unir(p, nombre)
    manchar(o, OXIDO, lambda P, Nn: np.clip(1.0 - P[:, 2], 0, 1) * 0.8 + 0.1, 0.7, 4.0, 3)
    variar(o, 0.2, 5.0, 4)
    manchar(o, MUSGO, lambda P, Nn: np.clip(0.3 - P[:, 2], 0, 1) * 3, 0.7, 3.0, 5)
    return suavizar(o, 40)


@pieza('reja', (380, 124, 20), ao_dist=0.6)
def reja(): return _acabar_reja(_reja(), 'reja')


@pieza('reja_rota', (380, 128, 20), ao_dist=0.6)
def reja_rota(): return _acabar_reja(_reja(rota=True), 'reja_rota')


@pieza('reja_puerta', (400, 198, 20), ao_dist=0.6)
def reja_puerta():
    """Cancela de dos hojas entreabiertas (2,4 × 0,5 × 1,82) con arco de hierro y una runa en lo alto."""
    p = [caja(2.4, 0.3, 0.12, (0, 0, 0.02), marca='monolito', color=PIEDRA_OSC, bisel=0.02)]
    for s in (-1, 1):
        hoja = []
        for i in range(N(4, 3, 1)):
            x = s * (0.12 + i * 0.3)
            hoja.append(barra((x, 0, 0.1), (x, 0, 1.6), 0.022, 4, 'liso', HIERRO))
        for z in (0.25, 1.45): hoja.append(barra((s * 0.05, 0, z), (s * 1.12, 0, z), 0.025, 4, 'liso', HIERRO))
        h = unir(hoja, 'hoja'); mover(h, (-s * 1.15, 0, 0)); mover(h, rot=(0, 0, -s * 0.5)); mover(h, (s * 1.15, 0, 0)); p.append(h)
    if _L[0] < 2:
        p.append(tubo(curva([(-1.15, 0, 1.6), (-0.6, 0, 1.78), (0, 0, 1.84), (0.6, 0, 1.78), (1.15, 0, 1.6)], N(9, 6, 3)), 0.025, 4, 'arco', 'liso', HIERRO, punta=False))
        p.append(runa((0, 0, 1.67), 0.16, 0.16, VIOLETA, grosor=0.02))
    return _acabar_reja(p, 'reja_puerta')


@pieza('farol_poste', (330, 113, 30), ao_dist=0.8)
def farol_poste():
    """Farol de camposanto (0,5 × 1,1 × 3): poste de hierro, brazo curvo y farol de cristal ambar."""
    p = [caja(0.4, 0.4, 0.3, (0, 0, 0.1), marca='monolito', color=PIEDRA_OSC, bisel=0.02)]
    p.append(torno([(0.06, 0.25), (0.05, 2.9), (0.08, 2.95), (0, 3.04)], N(6, 5, 4), 'liso', HIERRO))
    p.append(tubo(curva([(0, 0, 2.7), (0, -0.3, 2.82), (0, -0.62, 2.78), (0, -0.72, 2.66)], N(6, 4, 2)), 0.025, 4, 'brazo', 'liso', HIERRO, punta=False))
    c = (0, -0.72, 2.12)
    p.append(torno([(0.13, 0), (0.15, 0.04), (0.15, 0.36), (0.18, 0.4), (0.04, 0.52), (0, 0.54)] if _L[0] < 2 else [(0.15, 0), (0.15, 0.4), (0, 0.54)], 4, 'liso', HIERRO, loc=c, fase=math.pi / 4))
    p.append(torno([(0.128, 0.05), (0.128, 0.35), (0, 0.36)], 4, 'emisivo', BRASA, loc=c, fase=math.pi / 4))
    if _L[0] == 0:
        for k in range(4):
            a = k * math.pi / 2 + math.pi / 4
            p.append(barra((c[0] + math.cos(a) * 0.152, c[1] + math.sin(a) * 0.152, c[2] + 0.02), (c[0] + math.cos(a) * 0.152, c[1] + math.sin(a) * 0.152, c[2] + 0.38), 0.012, 3, 'liso', HIERRO))
    return acabar(p, 'farol_poste', base=0.1, guardar=('emisivo',))


@pieza('cipres', (420, 145, 40), ao_dist=1.4)
def cipres():
    """Cipres de camposanto (2,8 × 5,5): copa en huso, verde negruzco, y el tronco que asoma."""
    alto, ancho = 5.45, 1.5; bolas = []; n = 7
    for i in range(n):
        t = i / (n - 1); z = 0.9 + t * (alto - 1.4)
        r = ancho * (0.55 - 0.45 * t ** 1.4) * (1.0 - 0.15 * math.sin(i * 1.7))
        bolas.append((math.sin(i * 2.1) * 0.08, math.cos(i * 1.3) * 0.08, z, r, r, (alto - 1.4) / n * 1.1))
    bolas.append((0, 0, alto - 0.25, ancho * 0.08, ancho * 0.08, 0.35))
    o = masa(bolas, voxel=0.16, tris=N(340, 130, 30), ruido_f=0.12, ruido_e=1.6, semilla=3, marca='hoja', inflado=0.7)
    pintar_fn(o, lambda P, Nn, C: np.tile(np.array([0.42, 0.24, 0.5]), (len(P), 1)) * (0.75 + 0.35 * np.clip((P[:, 2] - 0.8) / alto, 0, 1))[:, None])
    variar(o, 0.25, 1.4, 3)
    t = tubo([(0, 0, -0.3), (0.03, 0.02, 1.4)], [0.16, 0.1], N(6, 5, 4), 'tronco', 'madera', MADERA_OSC, punta=False)
    return suavizar(unir([o, t], 'cipres'), 70)


@pieza('risco', (420, 165, 40), ao_dist=2.0)
def risco():
    """Risco grande (5 × 4,4 × 2,9): bloques partidos de la ladera."""
    return roca([(-1.0, 0, 0.6, 1.7, 1.5, 1.6), (1.1, 0.5, 0.3, 1.3, 1.2, 1.1), (0.4, -1.2, 0.0, 1.0, 0.8, 0.7), (-1.6, 1.0, 0.0, 0.8, 0.7, 0.5)], N(420, 160, 40), 13, voxel=0.22)


def _muro(roto):
    rng = azar(17 + roto); p = []
    hil = N(3, 1, 1)
    for k in range(hil):
        h = 1.5 / hil; n = N(3, 1, 1); off = 0.35 * (k % 2) * (n > 1)
        for i in range(n):
            w = 2.4 / n
            if roto and n > 1 and ((i == 2 and k >= 1) or (i == 1 and k == 2)): continue
            x0 = -1.2 + i * w + off; x1 = min(1.2, x0 + w)
            if i == 0 and off: p.append(caja(off - 0.04, 0.46, h - 0.03, (-1.2 + off / 2, 0, (k + 0.5) * h), marca='monolito', color=hexlin(PIEDRA) * rng.uniform(0.8, 1.15), tono=0.15, semilla=k * 3 + 9))
            p.append(caja(x1 - x0 - 0.04 * (n > 1), 0.46 - 0.03 * (k % 2), h - 0.03 * (hil > 1), ((x0 + x1) / 2, rng.uniform(-0.02, 0.02), (k + 0.5) * h), marca='monolito', color=hexlin(PIEDRA) * rng.uniform(0.8, 1.15), tono=0.15, semilla=k * 3 + i))
    if roto:
        p.append(caja(1.0, 0.56, 0.18, (-0.7, 0, 1.6), marca='monolito', color=PIEDRA_CLARA, bisel=0.03))
        if _L[0] < 2:
            p.append(caja(0.8, 0.45, 0.18, (0.8, -0.5, 0.1), (0.3, 0.1, 0.4), marca='monolito', color=PIEDRA_CLARA, bisel=0.03))
            for i in range(N(3, 1, 0)): p.append(piedra_suelta(0.18, (0.5 + 0.3 * i, -0.4 + 0.25 * i, 0.08), 20 + i))
    else:
        p.append(caja(2.42, 0.56, 0.18, (0, 0, 1.6), marca='monolito', color=PIEDRA_CLARA, bisel=0.03, tono=0.15, semilla=30))
    return acabar(p, 'muro_roto' if roto else 'muro_piedra', musgo=0.55, z_musgo=0.4)


@pieza('muro_piedra', (300, 90, 14), ao_dist=0.9)
def muro_piedra():
    """Tramo de muro de piedra (2,4 × 0,5 × 1,75): hiladas trabadas y albardilla."""
    return _muro(False)


@pieza('muro_roto', (300, 90, 14), ao_dist=0.9)
def muro_roto():
    """Muro de piedra derrumbado (2,4 × 0,5 × 1,75): la albardilla caida y piedras al pie."""
    return _muro(True)


@pieza('urna', (270, 80, 14), ao_dist=0.6)
def urna():
    """Urna funeraria de piedra (0,63 × 0,92) con tapa y asas."""
    p = [torno([(0.22, 0), (0.24, 0.06), (0.16, 0.12), (0.25, 0.3), (0.3, 0.5), (0.26, 0.68), (0.18, 0.74), (0.22, 0.78), (0.2, 0.82), (0.08, 0.86), (0.05, 0.92), (0, 0.93)] if _L[0] == 0 else [(0.22, 0), (0.3, 0.5), (0.18, 0.76), (0, 0.92)], N(10, 7, 5), 'monolito', PIEDRA_CLARA)]
    if _L[0] == 0:
        for s in (-1, 1): p.append(tubo(curva([(s * 0.24, 0, 0.62), (s * 0.33, 0, 0.66), (s * 0.29, 0, 0.45)], 4), 0.025, 4, 'asa', 'monolito', PIEDRA_CLARA, punta=False))
    return acabar(p, 'urna', musgo=0.5, z_musgo=0.3)


# ═══════════════ COSTA Y FUERTES: barcos, muelle, torres, estandartes ═══════════════
def casco(L, B, D, nst, m, proa=0.45, quilla=0.0, alcazar=0.9, huecos=None, color=MADERA):
    """Casco de tablazon con la proa hacia -Y: L eslora, B manga, D altura de la borda en el centro.
    huecos(t, j) → True quita ese trozo de tablazon (pecios). Devuelve (casco, cubierta)."""
    def manga(t):
        if t < proa: return max(0.04, B / 2 * (1 - (1 - t / proa) ** 2))
        return B / 2 * (1 - 0.28 * ((t - proa) / (1 - proa)) ** 2)
    def fondo(t): return quilla + 0.5 * D * max(0, 1 - t / 0.22) ** 2 + 0.15 * D * max(0, (t - 0.85) / 0.15) ** 2
    def borda(t): return D + 0.3 * D * max(0, 1 - t / 0.25) ** 2 + alcazar * max(0, (t - 0.7) / 0.3) ** 1.5
    verts = []; caras = []; secc = []
    for i in range(nst + 1):
        t = i / nst; y = -L / 2 + L * t; b = manga(t); k = fondo(t); d = borda(t)
        anillo = []
        for j in range(2 * m + 1):
            th = (j / m - 1) * math.pi / 2   # -90 (babor, borda) .. 0 (quilla) .. 90 (estribor, borda)
            s = math.sin(abs(th)); c = math.cos(th)
            x = math.copysign(b * s ** 0.45, th) if j != m else 0.0
            z = k + (d - k) * (1 - c ** 0.8)
            anillo.append(len(verts)); verts.append((x, y, z))
        secc.append(anillo)
    for i in range(nst):
        for j in range(2 * m):
            if huecos and huecos((i + 0.5) / nst, (j + 0.5) / (2 * m)): continue
            caras.append((secc[i][j], secc[i][j + 1], secc[i + 1][j + 1], secc[i + 1][j]))
    caras.append(tuple(secc[-1]))   # espejo de popa
    o = malla('casco', verts, caras, 'madera', color)
    dos_caras(o)
    # tablazon: franjas de tono y la obra viva verdinegra
    pintar_fn(o, lambda P, Nn, C: C * (0.82 + 0.3 * (np.sin(P[:, 2] * math.pi / 0.32) > 0))[:, None])
    manchar(o, '#24302a', lambda P, Nn: np.clip(0.9 + quilla - P[:, 2], 0, 1) * 2.5, 0.85, 2.0, 3)
    variar(o, 0.18, 1.2, 4, estirar=(1, 0.25, 1))
    cub = lamina(lambda u, v: ((u - 0.5) * 2 * manga(0.04 + 0.92 * v) * 0.96, -L / 2 + L * (0.04 + 0.92 * v), borda(0.04 + 0.92 * v) - 0.35 - alcazar * 0.0), 1, nst, 'madera', MADERA_CLARA, dos=False)
    pintar_fn(cub, lambda P, Nn, C: C * (0.8 + 0.3 * (np.sin(P[:, 0] * math.pi / 0.25) > 0))[:, None])
    return o, cub, borda


def vela_cuadra(ancho, alto, centro, color, semilla, rota=False, emblema=None):
    """Vela cuadra hinchada (de cara a -Y), con el borde de abajo deshilachado si esta rota y un emblema pintado."""
    nu, nv = N(4, 2, 1), N(4, 2, 1)
    rng = azar(semilla)
    cortes = [rng.uniform(0.35, 0.8) if rota else 1.0 for _ in range(nu + 1)]
    def f(u, v):
        vv = v * cortes[int(round(u * nu))]
        return (centro[0] + (u - 0.5) * ancho * (1 - 0.08 * vv), centro[1] - 0.45 * math.sin(math.pi * u) * math.sin(math.pi * min(1, vv * 1.1)) - 0.15 * vv, centro[2] - vv * alto)
    o = lamina(f, nu, nv, 'liso', color, dos=False)
    if emblema:
        pintar_fn(o, lambda P, Nn, C: np.where((np.abs(np.hypot((P[:, 0] - centro[0]) / ancho, (P[:, 2] - centro[2] + alto * 0.5) / alto) - 0.22) < 0.05)[:, None], hexlin(emblema), C))
    variar(o, 0.2, 1.0, semilla, tono=LONA_OSC)
    dos_caras(o)
    return o


def _barco(roto):
    L, B, D = 10.0, 4.4, 2.5
    rng = azar(31 + roto)
    huecos = (lambda t, j: (0.3 < t < 0.62 and 0.12 < j < 0.3) or (0.5 < t < 0.7 and 0.75 < j < 0.85) or (t > 0.85 and j > 0.8)) if roto and _L[0] < 2 else None
    o, cub, borda = casco(L, B, D, N(12, 7, 4), N(5, 3, 2), huecos=huecos, color='#4a3a2a' if not roto else '#4a463e')
    p = [o, cub]
    # castillo de popa con un farol y el bauprés
    zb = borda(0.85)
    p.append(caja(3.4, 2.2, 1.0, (0, L / 2 - 1.4, zb - 0.6), color=MADERA, tono=0.15, semilla=3))
    if _L[0] < 2:
        p.append(caja(3.5, 2.3, 0.1, (0, L / 2 - 1.4, zb - 0.07), color=MADERA_OSC))
        for x in (-1.0, 0.0, 1.0): p.append(caja(0.35, 0.05, 0.4, (x, L / 2 - 2.52, zb - 0.55), marca='emisivo' if not roto else 'liso', color='#6a3a14' if not roto else '#141216'))
    p.append(palo((0, -L / 2 + 0.6, borda(0.05) - 0.3), (0, -L / 2 - 1.6, borda(0) + 0.9), 0.12, MADERA_OSC, 4))
    # palos y velas
    for k, (y, alto) in enumerate(((0.6, 9.9), (-2.9, 8.2))):
        z0 = 0.3
        if roto and k == 1:
            p.append(palo((0, y, z0), (0.1, y, 4.2), 0.16, MADERA_OSC, 5 + k, punta=False))
            p.append(torno([(0.18, 4.2), (0.05, 4.55), (0, 4.4)], 5, 'madera', CORTE, loc=(0.1, y, 0)))
            continue
        p.append(palo((0, y, z0), (0, y, alto), 0.17 - 0.03 * k, MADERA_OSC, 5 + k))
        for j, (zy, an) in enumerate(((alto - 1.0, 3.2 - 0.4 * k), (alto - 4.2, 4.2 - 0.5 * k))):
            if _L[0] == 2 and j == 0: continue
            p.append(palo((-an / 2 - 0.2, y - 0.15, zy), (an / 2 + 0.2, y - 0.15, zy), 0.07, MADERA, 7 + j, punta=False))
            p.append(vela_cuadra(an, (2.6 if j else 2.0) * (0.95 if not roto else 0.8), (0, y - 0.2, zy - 0.05), '#6b5a46' if not roto else '#57514a', 40 + k * 3 + j, rota=roto, emblema=None))
        if _L[0] == 0 and k == 0:
            p.append(torno([(0.45, alto - 2.3), (0.55, alto - 1.95), (0.5, alto - 1.9), (0.4, alto - 2.25)], 8, 'madera', MADERA_OSC, loc=(0, y, 0)))
    if _L[0] == 0:
        for s in (-1, 1):   # obenques
            for y in (0.0, 1.2):
                p.append(barra((s * B / 2 * 0.95, y, borda(0.55)), (0, 0.6, 8.6), 0.012, 3, 'liso', CUERDA))
    if roto:   # costillas que asoman por los boquetes
        for t in (0.35, 0.45, 0.55):
            y = -L / 2 + L * t
            p.append(tubo(curva([(-B / 2 * 0.95, y, D * 0.95), (-B / 2 * 0.75, y, 0.6), (0, y, 0.05)], N(5, 3, 2)), 0.08, 4, 'costilla', 'madera', '#3a3226', punta=False))
    ob = acabar(p, 'pecio' if roto else 'barco', base=0.0, musgo=0.35 if roto else 0.0, z_musgo=0.8, guardar=('emisivo', 'liso'))
    return ob


@pieza('barco', (1700, 510, 160), ao_dist=2.0)
def barco():
    """Galera de dos palos (4,8 × 10,6 × 10): casco de tablazon, castillo de popa con ventanas encendidas, velas
    cuadras de lona curtida con un emblema de hueso y bauprés."""
    return _barco(False)


@pieza('pecio', (1700, 510, 160), ao_dist=2.0)
def pecio():
    """El mismo barco hecho pecio: tablazon reventada con las cuadernas a la vista, trinquete partido y velas en jirones."""
    return _barco(True)


@pieza('bote', (360, 130, 30), ao_dist=0.9)
def bote():
    """Bote de remos (2,75 × 2,4 × 0,85): casco de tingladillo, una bancada y dos remos."""
    o, cub, _b = casco(2.3, 1.1, 0.62, N(7, 4, 3), N(4, 2, 2), proa=0.4, alcazar=0.15, color='#55463a')
    p = [o, caja(1.0, 0.25, 0.06, (0, 0.1, 0.45), color=MADERA_CLARA)]
    borrar(cub)
    if _L[0] < 2:
        for s in (-1, 1):
            p.append(palo((s * 0.45, 0.1, 0.55), (s * 1.35, 0.35, 0.2), 0.03, MADERA_CLARA, 3 + s, punta=False))
            p.append(caja(0.32, 0.12, 0.02, (s * 1.2, 0.31, 0.25), (0, s * 0.35, 0), color=MADERA_CLARA))
    return acabar(p, 'bote', base=0.0)


@pieza('cantaro', (150, 90, 14), ao_dist=0.5)
def cantaro():
    """Botija de barro (0,47 × 0,9) con tapon de corcho."""
    p = [torno([(0, 0), (0.13, 0.01), (0.22, 0.2), (0.23, 0.42), (0.16, 0.62), (0.07, 0.72), (0.08, 0.82), (0, 0.82)] if _L[0] < 2 else [(0, 0), (0.23, 0.3), (0.08, 0.75), (0, 0.8)], N(8, 6, 4), 'liso', BARRO)]
    if _L[0] < 2: p.append(torno([(0.06, 0.8), (0.055, 0.88), (0, 0.89)], 5, 'liso', '#8a6a46'))
    o = acabar(p, 'cantaro', base=0.2)
    variar(o, 0.2, 4.0, 3)
    return o


@pieza('bombarda', (500, 277, 30), ao_dist=0.9)
def bombarda():
    """Bombarda en su cureña (1,4 × 1,9 × 1,05): caña de hierro con zunchos, gualderas de madera y cuatro ruedas."""
    p = []
    for s in (-1, 1): p.append(caja(0.14, 1.5, 0.5, (s * 0.32, 0.1, 0.42), (-0.12, 0, 0), color=MADERA, bisel=0.02, tono=0.15, semilla=3))
    p.append(caja(0.6, 1.3, 0.12, (0, 0.15, 0.22), color=MADERA_OSC))
    for y in (-0.45, 0.6):
        for s in (-1, 1):
            r = torno([(0, -0.06), (0.22, -0.06), (0.22, 0.06), (0, 0.06)], N(10, 6, 5), 'madera', MADERA_OSC)
            mover(r, rot=(0, math.pi / 2, 0)); mover(r, (s * 0.46, y, 0.22)); p.append(r)
        p.append(barra((-0.5, y, 0.22), (0.5, y, 0.22), 0.04, 4, 'liso', HIERRO))
    c = torno([(0.0, -0.05), (0.2, -0.05), (0.22, 0.1), (0.2, 0.4), (0.17, 1.2), (0.2, 1.25), (0.19, 1.32), (0.13, 1.32), (0.13, 1.2)] if _L[0] < 2 else [(0, -0.05), (0.21, 0.1), (0.17, 1.3), (0.13, 1.3)], N(10, 8, 6), 'liso', HIERRO)
    mover(c, rot=(math.pi / 2 + 0.12, 0, 0)); mover(c, (0, 0.65, 0.78))
    p.append(c)
    if _L[0] == 0:
        for k in range(3):
            z = 0.35 + k * 0.32
            a = torno([(0.205 - 0.01 * k, z), (0.205 - 0.01 * k, z + 0.06)], 10, 'liso', HIERRO_CLARO)
            mover(a, rot=(math.pi / 2 + 0.12, 0, 0)); mover(a, (0, 0.65, 0.78)); p.append(a)
    return acabar(p, 'bombarda', base=0.2)


@pieza('bala', (80, 30, 12), ao_dist=0.4)
def bala():
    """Bala de piedra y hierro (0,64), medio hundida."""
    o = esfera((0, 0, 0.0), 0.32, N(2, 1, 1), marca='liso', color=HIERRO)
    variar(o, 0.3, 6.0, 2)
    return acabar([o], 'bala', base=0.0)


def _hiladas(ancho, fondo, alto, z0, n, semilla, color=PIEDRA, x=0.0, y=0.0):
    """Bloque de muro en n hiladas, cada una algo desigual."""
    rng = azar(semilla); p = []
    for k in range(n):
        h = alto / n
        p.append(caja(ancho - 0.05 * (k % 2), fondo - 0.04 * (k % 2), h - 0.02 * (n > 1), (x, y, z0 + (k + 0.5) * h), marca='monolito', color=hexlin(color) * rng.uniform(0.82, 1.12), tono=0.15, semilla=semilla + k))
    return p


def _almenas(ancho, y, z, n, alto=0.55, fondo=0.4, semilla=0, color=PIEDRA_CLARA):
    p = []
    for i in range(n):
        x = -ancho / 2 + (i + 0.5) * ancho / n
        p.append(caja(ancho / n * 0.55, fondo, alto, (x, y, z + alto / 2), marca='monolito', color=hexlin(color) * (0.9 + 0.1 * (i % 2)), bisel=0.03, tono=0.15, semilla=semilla + i))
    return p


@pieza('portal_fuerte', (800, 359, 60), ao_dist=2.0)
def portal_fuerte():
    """Puerta fortificada (4 × 3,6 × 4,4): dos machones, arco de dovelas, rastrillo levantado, hojas de madera
    abiertas hacia dentro y almenas. El paso del centro queda libre."""
    p = []
    for s in (-1, 1): p += _hiladas(1.0, 3.0, 3.9, 0, N(3, 2, 1), 3 + s, x=s * 1.5)
    nd = N(6, 4, 3)
    for i in range(nd):
        a0 = math.pi * i / nd; a1 = math.pi * (i + 1) / nd; a = (a0 + a1) / 2
        r = 1.25
        p.append(caja(0.45, 3.0, r * (a1 - a0) * 1.25, (math.cos(a) * r, 0, 2.55 + math.sin(a) * r), (0, -a + math.pi / 2, 0), marca='monolito', color=hexlin(PIEDRA_CLARA) * (0.9 + 0.12 * (i % 2)), tono=0.12, semilla=10 + i))
    for s in (-1, 1): p.append(caja(1.0, 3.0, 1.2, (s * 1.5, 0, 3.6 - 0.3 + 0.3), marca='monolito', color=PIEDRA, tono=0.15, semilla=20 + s))
    p.append(caja(1.4, 3.0, 0.5, (0, 0, 3.95), marca='monolito', color=PIEDRA, tono=0.15, semilla=22))
    p.append(caja(4.1, 3.2, 0.14, (0, 0, 4.15), marca='monolito', color=PIEDRA_CLARA, bisel=0.03))
    p += _almenas(4.0, -1.4, 4.2, 4, 0.5, 0.35, 30)
    if _L[0] < 2:
        if _L[0] == 0: p += _almenas(4.0, 1.4, 4.2, 4, 0.5, 0.35, 40)
        for x in (-0.6, -0.2, 0.2, 0.6): p.append(caja(0.05, 0.08, 0.8, (x, -0.6, 3.1), marca='liso', color=HIERRO))
        for z in (2.9, 3.3): p.append(caja(1.3, 0.08, 0.05, (0, -0.6, z), marca='liso', color=HIERRO))
        for s in (-1, 1):
            p.append(caja(0.08, 1.1, 2.4, (s * 0.92, 0.75, 1.2), (0, 0, s * 0.12), color=MADERA_OSC, tono=0.18, semilla=50 + s))
        p.append(runa((0, -1.52, 3.55), 0.35, 0.3, VIOLETA, grosor=0.02))
    return acabar(p, 'portal_fuerte', musgo=0.5, z_musgo=0.6, base=0.3)


@pieza('muro_fuerte', (300, 90, 20), ao_dist=1.6)
def muro_fuerte():
    """Lienzo de muralla (2 × 2,8 × 4,4): hiladas de sillares, adarve y dos almenas al frente."""
    p = _hiladas(2.0, 2.6, 3.9, 0, N(5, 2, 1), 5)
    p.append(caja(2.05, 2.8, 0.14, (0, 0, 3.95), marca='monolito', color=PIEDRA_CLARA, bisel=0.03))
    p += _almenas(2.0, -1.2, 4.0, 2, 0.45, 0.35, 8)
    if _L[0] < 2: p += _almenas(2.0, 1.2, 4.0, N(2, 1, 0), 0.4, 0.3, 12)
    return acabar(p, 'muro_fuerte', musgo=0.5, z_musgo=0.6, base=0.3)


def _estandarte(tela, emblema, semilla):
    """Estandarte en horca (1,35 × 0,4 × 3,6): mastil, brazo y paño con dos colas; el emblema es un ojo en un rombo."""
    p = [palo((-0.5, 0, -0.3), (-0.5, 0, 3.55), 0.06, MADERA_OSC, semilla)]
    p.append(palo((-0.62, 0, 3.3), (0.62, 0, 3.3), 0.04, MADERA_OSC, semilla + 1, punta=False))
    p.append(torno([(0.07, 3.55), (0.0, 3.75)], 4, 'liso', HIERRO_CLARO, loc=(-0.5, 0, 0)))
    W, H = 0.95, 1.9
    def f(u, v):   # el borde de abajo sube en el centro: dos colas
        return (-0.47 + W * u, 0.06 * math.sin(v * 5 + u * 2) * v, 3.27 - H * v + (0.4 * (1 - abs(u - 0.5) * 2) if v == 1 else 0))
    o = lamina(f, N(4, 2, 2), N(6, 3, 1), 'liso', tela)
    cx = -0.47 + W / 2
    if _L[0] < 2:   # emblema cosido: rombo hueco con un ojo en medio, por las dos caras
        cz = 2.45; yv = 0.06 * math.sin(0.43 * 5 + 1.0) * 0.43
        for lado in (-1, 1):
            e = []
            for k, (rx, rz) in enumerate(((0.26, 0.36), (0.16, 0.23))):
                e += [(cx + rx, cz), (cx, cz + rz), (cx - rx, cz), (cx, cz - rz)]
            verts = [(x, yv + lado * 0.012, z) for x, z in e] + [(cx + 0.07, yv + lado * 0.012, cz), (cx, yv + lado * 0.012, cz + 0.09), (cx - 0.07, yv + lado * 0.012, cz), (cx, yv + lado * 0.012, cz - 0.09)]
            caras = [(i, (i + 1) % 4, 4 + (i + 1) % 4, 4 + i) for i in range(4)] + [(8, 9, 10, 11)]
            if lado > 0: caras = [tuple(reversed(c)) for c in caras]
            p.append(malla('emblema', verts, caras, 'liso', emblema))
    pintar_fn(o, lambda P, Nn, C: np.where((P[:, 2] > 3.15)[:, None] | (np.abs(P[:, 0] - cx) > W / 2 - 0.06)[:, None], hexlin(ORO) * 0.8, C))
    variar(o, 0.15, 2.0, semilla)
    p.append(o)
    return acabar(p, 'estandarte', base=0.0, guardar=('liso',))


@pieza('estandarte', (260, 80, 24), ao_dist=0.8)
def estandarte(): return _estandarte(ESTANDARTE, ORO, 3)


@pieza('mastil', (360, 131, 30), ao_dist=1.2)
def mastil():
    """Palo de barco suelto (4,4 × 1,7 × 7,9): verga con la vela aferrada, cofa y cabos colgando."""
    p = [palo((0, 0, 0), (0, 0, 7.85), 0.17, MADERA_OSC, 2)]
    p.append(palo((-2.15, -0.15, 6.2), (2.15, -0.15, 6.2), 0.08, MADERA, 3, punta=False))
    p.append(tubo(curva([(-1.9, -0.32, 6.08), (0, -0.4, 6.0), (1.9, -0.32, 6.08)], N(6, 4, 2)), 0.14, N(6, 5, 4), 'aferrada', 'liso', '#6b5f4c', punta=False))
    if _L[0] < 2:
        p.append(torno([(0.5, 6.7), (0.6, 7.0), (0.55, 7.05), (0.42, 6.75)], N(8, 6, 4), 'madera', MADERA_OSC))
        for s in (-1, 1): p.append(tubo(curva([(s * 1.8, -0.3, 6.0), (s * 1.5, -0.5, 4.5), (s * 1.6, -0.4, 3.0)], 4), 0.015, 3, 'cabo', 'liso', CUERDA, punta=False))
    return acabar(p, 'mastil', base=0.0)


@pieza('palmera', (420, 181, 40), ao_dist=1.2)
def palmera():
    """Palmera de costa (3,2 × 3,2 × 4,25): tronco anillado y curvo, abanico de hojas caidas y cocos."""
    rng = azar(9); p = []
    pts = curva([(0, 0, -0.3), (0.25, 0, 1.4), (0.55, 0.1, 2.8), (0.6, 0.1, 3.75)], N(9, 6, 4))
    t = tubo(pts, np.linspace(0.2, 0.13, len(pts)), N(6, 5, 4), 'tronco', 'madera', '#6a5a46')
    pintar_fn(t, lambda P, Nn, C: C * (0.8 + 0.3 * (np.sin(P[:, 2] * 18) > 0.3))[:, None])
    p.append(t)
    top = np.array(pts[-1])
    nh = N(8, 5, 4)
    for k in range(nh):
        a = k * 2 * math.pi / nh + rng.uniform(-0.2, 0.2); d = np.array([math.cos(a), math.sin(a), 0.0]); lado = np.array([-math.sin(a), math.cos(a), 0.0])
        L = 1.6 + rng.uniform(-0.2, 0.25)
        def f(u, v, d=d, lado=lado, L=L):
            s = v * L; caida = 0.35 * s - 0.75 * s * s / L
            w = 0.32 * math.sin(math.pi * min(1, v * 1.15 + 0.05)) * (u - 0.5) * 2
            pz = caida - abs(w) * 0.35
            return tuple(top + d * s + lado * w + np.array([0, 0, pz]))
        h = lamina(f, 2, N(4, 2, 2), 'hoja', (0.45, 0.4, 0.42), dos=False)
        pintar_fn(h, lambda P, Nn, C: C * (0.75 + 0.4 * np.clip((P[:, 2] - top[2] + 0.6), 0, 1))[:, None])
        dos_caras(h); p.append(h)
    if _L[0] < 2:
        for k in range(N(3, 2, 0)):
            a = k * 2.1
            p.append(esfera(tuple(top + np.array([math.cos(a) * 0.17, math.sin(a) * 0.17, -0.15])), 0.11, 1, marca='liso', color='#4a3a26'))
    return acabar(p, 'palmera', base=0.0, guardar=('hoja',))


def _torre_redonda(alto, r, semilla, lados):
    """Fuste de torre redonda en hiladas: cada anillo de piedra con su tono y un leve desplome."""
    rng = azar(semilla)
    n = N(int(alto / 0.9), int(alto / 2.2), 2)
    perfil = []
    for i in range(n + 1):
        z = alto * i / n; rr = r * (1 - 0.06 * i / n) + (rng.uniform(-0.02, 0.02) if 0 < i < n else 0)
        perfil.append((rr, z))
    o = torno(perfil, lados, 'monolito', PIEDRA, fase=0.2)
    zs = np.array([z for _, z in perfil]); tonos = rng.uniform(0.82, 1.15, n + 1)
    pintar_fn(o, lambda P, Nn, C: C * tonos[np.clip(np.searchsorted(zs, P[:, 2] - 0.01), 0, n)][:, None])
    return o


@pieza('torre', (1050, 320, 80), ao_dist=2.5)
def torre():
    """Torre de vigia redonda (3,6 × 3,6 × 10,2): fuste en hiladas, saeteras, puerta con dintel, ventana encendida,
    matacan sobre canecillos y ocho almenas."""
    R, H = 1.62, 9.2; p = [_torre_redonda(H, R, 3, N(14, 10, 7))]
    p.append(torno([(R * 0.94 + 0.02, H - 0.05), (R * 1.12, H + 0.28), (R * 1.12, H + 0.45), (R * 0.9, H + 0.45)], N(14, 10, 7), 'monolito', PIEDRA_CLARA))
    na = N(8, 6, 0)
    for i in range(na):
        a = 2 * math.pi * i / na
        p.append(caja(0.62, 0.42, 0.55, (math.cos(a) * R * 1.0, math.sin(a) * R * 1.0, H + 0.72), (0, 0, a + math.pi / 2), marca='monolito', color=hexlin(PIEDRA_CLARA) * (0.9 + 0.1 * (i % 2)), bisel=0.03, tono=0.15, semilla=i))
    if _L[0] == 2: p.append(torno([(R * 1.05, H + 0.45), (R * 1.05, H + 1.0), (R * 0.9, H + 1.0)], 7, 'monolito', PIEDRA_CLARA))
    # puerta al frente (-Y) y saeteras
    p.append(caja(1.0, 0.25, 1.9, (0, -R + 0.02, 0.95), marca='monolito', color=PIEDRA_CLARA, bisel=0.03))
    p.append(caja(0.72, 0.2, 1.6, (0, -R - 0.05, 0.8), marca='madera', color=MADERA_OSC))
    if _L[0] < 2:
        for k, (z, a) in enumerate(((3.2, 0.7), (5.2, 2.6), (6.8, -1.2), (4.4, -2.4), (7.6, 1.6))):
            p.append(caja(0.12, 0.2, 0.75, (math.sin(a) * (R - 0.02), -math.cos(a) * (R - 0.02), z), (0, 0, a), marca='liso', color='#141216'))
        p.append(caja(0.4, 0.2, 0.6, (0, -(R * 0.96 - 0.02), 7.8), marca='emisivo', color='#7a4416'))
        for i in range(N(8, 0, 0)):
            a = 2 * math.pi * (i + 0.5) / 8
            p.append(caja(0.16, 0.3, 0.3, (math.cos(a) * R * 1.0, math.sin(a) * R * 1.0, H + 0.05), (0, 0, a + math.pi / 2), marca='monolito', color=PIEDRA))
    return acabar(p, 'torre', musgo=0.5, z_musgo=1.2, base=0.3, guardar=('emisivo',))


@pieza('torre_chica', (800, 277, 70), ao_dist=2.2)
def torre_chica():
    """Torre cuadrada (3,35 × 3,65 × 6,8): base de sillares en talud, cuerpo de piedra y cadalso de madera volado
    con tejado a cuatro aguas."""
    p = [caja(3.1, 3.1, 0.6, (0, 0, 0.0), marca='monolito', color=PIEDRA_OSC, bisel=0.04)]
    p += _hiladas(2.8, 2.8, 4.4, 0.3, N(6, 2, 1), 7)
    zc = 4.7
    p.append(caja(3.3, 3.6, 0.15, (0, 0, zc), color=MADERA_OSC))
    nt = N(5, 2, 1)
    for s in (-1, 1):
        for i in range(nt):
            w = 3.2 / nt
            p.append(caja(w - 0.04, 0.07, 1.0, (-1.6 + (i + 0.5) * w, s * 1.76, zc + 0.55), color=hexlin(MADERA_GRIS) * (0.85 + 0.25 * ((i + (s > 0)) % 2)), tono=0.15, semilla=i))
            p.append(caja(0.07, w * 1.1 - 0.04, 1.0, (s * 1.6, -1.75 + (i + 0.5) * w * 1.1, zc + 0.55), color=hexlin(MADERA_GRIS) * (0.85 + 0.25 * (i % 2)), tono=0.15, semilla=i + 9))
    if _L[0] < 2:
        for s in (-1, 1):
            for x in (-1.1, 0.0, 1.1): p.append(caja(0.12, 0.6, 0.12, (x, s * 1.6, zc - 0.12), (s * 0.5, 0, 0), color=MADERA_OSC))
            p.append(caja(0.2, 0.08, 0.35, (0.5 * s, -1.8, zc + 0.6), marca='liso', color='#141216'))
    p.append(torno([(2.45, zc + 1.0), (0, 6.79)], 4, 'madera', MADERA_OSC, fase=math.pi / 4))
    p.append(caja(0.9, 0.2, 1.7, (0, -1.42, 1.15), marca='madera', color=MADERA_OSC))
    if _L[0] < 2: p.append(caja(1.15, 0.22, 0.18, (0, -1.44, 2.05), marca='monolito', color=PIEDRA_CLARA))
    return acabar(p, 'torre_chica', musgo=0.45, z_musgo=0.9, base=0.3)


@pieza('atalaya_madera', (520, 196, 40), ao_dist=1.4)
def atalaya_madera():
    """Garita de madera sobre pies derechos (3 × 3 × 2,8): tablado a 1,9 m, antepecho, tornapuntas y escala."""
    p = []
    for sx in (-1, 1):
        for sy in (-1, 1): p.append(palo((sx * 1.3, sy * 1.3, -0.3), (sx * 1.25, sy * 1.25, 2.8), 0.09, MADERA_OSC, sx + 2 * sy, punta=False))
    p += tablas(N(6, 2, 1), 2.9, 2.9, 0.08, (0, 0, 1.9), eje='x', color=MADERA_GRIS, semilla=4)
    for s in (-1, 1):
        p.append(caja(2.9, 0.06, 0.6, (0, s * 1.3, 2.45), color=hexlin(MADERA) * 1.05, tono=0.15, semilla=5 + s))
        p.append(caja(0.06, 2.9, 0.6, (s * 1.3, 0, 2.45), color=MADERA, tono=0.15, semilla=7 + s))
    if _L[0] < 2:
        for s in (-1, 1):
            p.append(palo((s * 1.28, -1.28, 0.2), (-s * 1.28, -1.28, 1.8), 0.05, MADERA, 9 + s, punta=False))
            p.append(palo((-1.28, s * 1.28, 0.2), (-1.28, -s * 1.28, 1.8), 0.05, MADERA, 11 + s, punta=False))
        for s in (-1, 1): p.append(palo((s * 0.25, -1.75, -0.1), (s * 0.25, -1.35, 2.0), 0.035, MADERA_CLARA, 13 + s, punta=False))
        for k in range(N(5, 3, 0)):
            z = 0.25 + k * 0.38; y = -1.75 + 0.4 * (z + 0.1) / 2.1
            p.append(palo((-0.27, y, z), (0.27, y, z), 0.025, MADERA_CLARA, 15 + k, punta=False))
    return acabar(p, 'atalaya_madera', base=0.3, musgo=0.2)
