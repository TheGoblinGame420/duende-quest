# ═══════════════════════════════════════════════════════
# DUENDE QUEST — familia RUINAS («medieval mistico»): portales, menhires, arcos, muretes, hitos y entradas.
# Diseños propios, generados por guion. Los coloca mundo/js/ruinas.js en las MISMAS posiciones que las piezas
# de cajas de arquitectura.js (las colisiones y los puntos de interaccion no cambian), salvo `puerta_nucleo`,
# que sustituye a la pieza del kit `c_metal-gate` (la Puerta del Nucleo del asedio).
# Piedra de sillares sueltos (cada bloque con sus cantos matados y su desgaste), musgo y raices horneados y
# runas talladas como cintas pegadas a la piedra con la marca `emisivo` (brillan mas de noche).
# Convenio: X de Blender = x del juego, -Y = z del juego (el frente mira a -Y), Z arriba, origen en el suelo.
# ═══════════════════════════════════════════════════════
import math
import bmesh
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from dq_lib import *

GRIS = ['#99948a', '#878279', '#a39e93', '#8e8982']
MUSGO = '#34421f'
HIERRO = '#33333a'
MADERA = '#4a3a2b'
RAIZ = '#3a2e22'
VIO = '#b98aff'      # runas del portal, los arcos y las entradas
NAR = '#ff8a4a'      # runas de los menhires del Titan
CIAN = '#8fdcff'     # runas de los hitos
BRASA = '#ffa64a'
GRIETA = '#211e1b'


# ── piezas ──
def bloque(c, t, sem, lod=0, rot=(0, 0, 0), bis=0.06, sub=0, rug=0.04, marca='piedra', color=None):
    """Sillar: caja con los cantos matados y la piel movida por un ruido. c: centro, t: tamaño (x, y, z)."""
    o = primitiva('cubo', marca=marca, color=color or GRIS[sem % 4], lado=1.0)
    mover(o, esc=t)
    if lod == 0 and bis: biselar(o, min(bis, 0.22 * min(t)), 1)
    if sub and lod < 2: subdividir(o, sub if lod == 0 else max(1, sub - 1), simple=True)
    if rug and lod < 2: desplazar(o, rug, 0.8, semilla=sem, octavas=2)
    return mover(o, c, rot)


def pila(x, y, z0, ancho, fondo, alturas, sem, lod, giro=0.04, marca='piedra'):
    """Pilar de sillares apilados, cada uno algo corrido y girado. En el nivel bajo, una sola caja."""
    total = float(sum(alturas))
    if lod == 2: return [bloque((x, y, z0 + total / 2), (ancho, fondo, total), sem, 2, marca=marca)]
    rng = azar(sem + 900); objs = []; z = z0
    for i, h in enumerate(alturas):
        dx, dy = rng.uniform(-0.04, 0.04, 2); rz = rng.uniform(-giro, giro)
        objs.append(bloque((x + dx, y + dy, z + h / 2), (ancho * rng.uniform(0.95, 1.04), fondo * rng.uniform(0.95, 1.04), h - 0.025), sem * 7 + i, lod, rot=(0, 0, rz), marca=marca))
        z += h
    return objs


def escombro(c, r, sem, lod, esc=(1.0, 0.85, 0.6)):
    """Piedra suelta medio hundida."""
    o = primitiva('esfera', marca='piedra', color=GRIS[sem % 4], radio=r, subdiv=1)
    mover(o, esc=esc); desplazar(o, r * 0.28, 1.1 / r, semilla=sem)
    decimar(o, 30 if lod == 0 else 14)
    return mover(o, c, (0, 0, sem * 1.3))


def medio_disco(r, fondo, n, color, marca='piedra'):
    """Timpano: medio disco de pie (en el plano XZ), con el diametro en z = 0."""
    A = [math.pi * k / n for k in range(n + 1)]
    V = [(r * math.cos(a), -fondo / 2, r * math.sin(a)) for a in A] + [(r * math.cos(a), fondo / 2, r * math.sin(a)) for a in A]
    m = n + 1
    caras = [tuple(range(m)), tuple(range(2 * m - 1, m - 1, -1))]
    for k in range(n): caras.append((k + 1, k, m + k, m + k + 1))
    caras.append((0, m, 2 * m - 1, m - 1))
    o = malla('timpano', V, caras, marca, color)
    bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(o.data); bm.free(); o.data.update()
    return o


def bvh_de(obj):
    aplicar(obj); P = pos(obj)
    return BVHTree.FromPolygons([tuple(p) for p in P], [tuple(p.vertices) for p in obj.data.polygons])


# ── runas y grietas: cintas proyectadas sobre la piedra ──
# Ocho signos propios sobre una rejilla de 3 × 4 (u: 0..2, v: 0..3).
GLIFOS = [
    [[(1, 0), (1, 3)], [(0, 2), (1, 3), (2, 2)]],
    [[(1, 0), (1, 3)], [(0, 1), (2, 2)], [(0, 2), (1, 2.5)]],
    [[(1, 0), (1, 1)], [(1, 1), (0, 2), (1, 3), (2, 2), (1, 1)]],
    [[(0, 0), (0, 3)], [(0, 3), (2, 2), (0, 1)], [(0, 1), (2, 0)]],
    [[(0, 3), (2, 3)], [(1, 3), (1, 0)], [(0, 0), (1, 1), (2, 0)]],
    [[(0, 0), (2, 3)], [(2, 0), (0, 3)], [(0, 1.5), (2, 1.5)]],
    [[(0, 0), (0, 3)], [(2, 0), (2, 3)], [(0, 2), (2, 1)]],
    [[(1, 0), (0, 1), (0, 2), (1, 3), (2, 2), (2, 1), (1, 0)], [(1, 0.8), (1, 2.2)], [(0.5, 1.5), (1.5, 1.5)]],
]


def trazos(bvh, lineas, origen, U, V, N, ancho, color, marca='emisivo', sub=2, fuera=0.022, alcance=2.5):
    """Cintas que siguen las polilineas `lineas` [(u, v), ...] del plano (origen, U, V) y se pegan a la malla del
    `bvh` tirando rayos en direccion -N. Quedan `fuera` metros por delante de la piedra."""
    origen = np.array(origen, dtype=float); U = np.array(U, dtype=float); V = np.array(V, dtype=float); N = np.array(N, dtype=float)
    verts = []; caras = []
    for L in lineas:
        L = np.array(L, dtype=float); pts = []
        for a, b in zip(L[:-1], L[1:]):
            for s in range(sub): pts.append(a + (b - a) * s / sub)
        pts.append(L[-1]); pts = np.array(pts)
        T = np.gradient(pts, axis=0); T /= np.linalg.norm(T, axis=1)[:, None] + 1e-9
        lado = np.c_[-T[:, 1], T[:, 0]]; base = len(verts); nuevos = []; d0 = None
        for p, l in zip(pts, lado):
            for sg in (-1, 1):
                q = p + l * sg * ancho / 2; w = origen + U * q[0] + V * q[1]
                h = bvh.ray_cast(Vector(w + N * alcance), Vector(-N), alcance * 2) if bvh else (None,)
                # Un rayo que no da en la piedra, o que da mucho mas al fondo que el primero, deja la cinta en el aire: se descarta el trazo.
                if h[0] is None or (d0 is not None and abs(h[3] - d0) > 0.3): nuevos = None; break
                if d0 is None: d0 = h[3]
                nuevos.append(np.array(h[0]) + N * fuera)
            if nuevos is None: break
        if not nuevos: continue
        verts += nuevos
        for i in range(len(pts) - 1): caras.append((base + 2 * i, base + 2 * i + 2, base + 2 * i + 3, base + 2 * i + 1))
    if not caras: return None
    o = malla('trazos', verts, caras, marca, color); o['dq_afilado'] = 1
    # Que la cara mire hacia fuera (N).
    nn = np.zeros(len(o.data.polygons) * 3); o.data.polygons.foreach_get('normal', nn)
    if (nn.reshape(-1, 3) @ N).mean() < 0: o.data.flip_normals(); o.data.update()
    return o


def runa(bvh, k, centro, N, ancho, alto, color, lod, grosor=0.085, arriba=(0, 0, 1)):
    """Runa `k` tallada en la cara que mira a N, centrada en `centro`."""
    N = np.array(N, dtype=float); V = np.array(arriba, dtype=float); U = np.cross(V, N)
    g = GLIFOS[k % len(GLIFOS)]
    if lod == 2: g = [[(1, 0.2), (1, 2.8)]]
    lin = [[((u - 1) * ancho / 2, (v - 1.5) * alto / 3) for u, v in L] for L in g]
    return trazos(bvh, lin, centro, U, V, N, grosor * (1.0, 1.15, 2.6)[lod], color, sub=(2, 1, 1)[lod])


def grieta(bvh, origen, N, largo, sem, ancho=0.04):
    """Grieta oscura que baja en zigzag (solo en el nivel alto)."""
    rng = azar(sem); N = np.array(N, dtype=float); V = np.array([0, 0, 1.0]); U = np.cross(V, N)
    n = 6; pts = [(0.0, 0.0)]
    for i in range(1, n): pts.append((pts[-1][0] + rng.uniform(-0.16, 0.16), -largo * i / (n - 1)))
    lin = [pts, [pts[2], (pts[2][0] + rng.choice([-1, 1]) * 0.28, pts[2][1] - 0.3)]]
    return trazos(bvh, lin, origen, U, V, N, ancho, GRIETA, marca='liso', sub=1, fuera=0.012)


def envejecer(o, sem, musgo=0.8, pie=0.9, vetas=True):
    """Color de la piedra: manchas, chorreras, musgo arriba y al pie y cantos gastados."""
    variar(o, 0.17, 0.8, semilla=sem)
    if vetas: variar(o, 0.1, 2.2, semilla=sem + 2, estirar=(1, 1, 0.12))
    variar(o, 0.08, 0.22, semilla=sem + 3, tono='#7d7862')
    manchar(o, MUSGO, lambda P, N: N[:, 2] * 1.15 - 0.2 + np.clip(pie - P[:, 2], 0, 1) * 0.75, musgo, escala=0.7, semilla=sem + 5)
    desgastar(o, 0.28, 0.3)
    return suavizar(o, 40)


def raiz(pts, r0, lod, r1=0.035, color=RAIZ):
    n = (9, 5)[min(lod, 1)]
    return tubo(curva(pts, n), np.linspace(r0, r1, n), (5, 4)[min(lod, 1)], 'raiz', 'madera', color)


def brasero(x, y, z, lod, r=0.5):
    """Copa de hierro con brasas (la llama es un punto que pone el juego encima)."""
    lados = (9, 6, 5)[lod]
    copa = mover(primitiva('cono', marca='liso', color=HIERRO, r1=r * 0.55, r2=r, alto=r * 0.72, lados=lados), (x, y, z))
    asc = mover(primitiva('cono', marca='emisivo', color=BRASA, r1=r * 0.72, r2=0.0, alto=r * 1.0, lados=lados), (x, y, z + r * 0.55))
    suavizar(copa, 30); suavizar(asc, 30)
    return [copa, asc]


def cerrar(piedra, extras, lod):
    o = unir([piedra] + [e for e in extras if e is not None])
    return o


# ═══════════ PORTAL DE LAS MAZMORRAS ═══════════
@modelo('portal_mazmorra', tris=(3000, 1000, 300), ao=0.8, ao_dist=1.8)
def portal_mazmorra(lod):
    S = []
    for s in (-1, 1):
        x = s * 2.2
        if lod < 2:
            S.append(bloque((x, 0, 0.3), (1.78, 1.8, 1.0), 11 + s, lod))                   # basa
            S.append(bloque((x, 0, 0.95), (1.46, 1.5, 0.32), 13 + s, lod))                 # moldura
            S.append(bloque((x, -1.25, 0.0), (2.1, 0.8, 0.4), 15 + s, lod, rot=(0, 0, s * 0.05)))   # peldaño delantero
        S += pila(x, 0, 1.1, 1.12, 1.2, [1.0, 0.85, 1.05, 0.8, 0.9], 21 + s, lod)          # fuste: 1.1 → 5.7
        S.append(bloque((x, 0, 5.9), (1.5, 1.56, 0.42), 31 + s, lod))                       # capitel
        xb = s * 3.45                                                                       # contrafuerte
        S += pila(xb, 0.05, -0.3, 1.36, 1.6, [1.5, 1.3, 1.2, 1.0], 41 + s, lod)
        S.append(bloque((xb + s * 0.12, 0.05, 4.92), (1.3, 1.52, 0.75), 45 + s, lod, rot=(0, s * 0.5, 0)))
        xp = s * 4.55                                                                       # pedestal del brasero
        S += pila(xp, 0, -0.3, 1.16, 1.3, [1.45, 1.15], 51 + s, lod)
        if lod < 2: S.append(bloque((xp, 0, 2.4), (1.42, 1.5, 0.26), 55 + s, lod))
    # Arco de dovelas (11; la clave, mas grande y salida).
    nd = 11 if lod < 2 else 5
    for k in range(nd):
        a = (k + 0.5) / nd * math.pi; clave = k == nd // 2; r = 2.55 + (0.14 if clave else 0.0)
        t = (math.pi * 2.6 / nd * (1.02 if lod < 2 else 1.1), 1.5 if clave else 1.3, 1.3 if clave else 0.96)
        S.append(bloque((math.cos(a) * r, 0, 6.05 + math.sin(a) * r), t, 60 + k, lod, rot=(0, math.pi / 2 - a, 0), bis=0.07))
    tim = medio_disco(2.1, 0.5, (12, 8, 5)[lod], '#b5b0a4'); mover(tim, (0, 0, 6.03)); S.append(tim)
    S.append(bloque((0, 0, 5.83), (3.42, 1.0, 0.44), 72, lod))                              # dintel
    # Enjutas en ruina: mas altas a la izquierda, caidas a la derecha.
    for i, (c, t, r) in enumerate([((-3.05, 0, 6.6), (1.35, 1.36, 1.0), 0.0), ((-3.1, 0.02, 7.52), (1.2, 1.3, 0.86), 0.04), ((-2.85, 0, 8.3), (0.95, 1.24, 0.72), -0.08),
                                   ((3.05, 0, 6.6), (1.35, 1.36, 1.0), 0.0), ((3.2, -0.03, 7.38), (0.95, 1.3, 0.6), 0.14)]):
        if lod == 2 and i in (2, 4): continue
        S.append(bloque(c, t, 80 + i, lod, rot=(0, r, 0)))
    if lod < 2:
        S.append(bloque((0, 0, -0.03), (3.5, 2.3, 0.2), 90, lod, bis=0.04))                 # umbral gastado
        # Sillares caidos y escombros a los lados (bajos: no estorban el paso).
        S.append(bloque((5.75, -1.25, 0.12), (1.0, 0.8, 0.7), 91, lod, rot=(0.3, 0.2, 0.7)))
        S.append(bloque((5.5, 1.3, 0.05), (0.8, 0.9, 0.6), 92, lod, rot=(0.2, -0.3, 0.3)))
        for i, (x, y, r) in enumerate([(-5.6, -1.1, 0.42), (-5.9, 0.8, 0.34), (6.3, -0.3, 0.3)] + ([(-1.2, 1.5, 0.2), (4.6, -1.35, 0.26)] if lod == 0 else [])):
            S.append(escombro((x, y, r * 0.12), r, 93 + i, lod))
    p = unir(S)
    decimar(p, (2250, 760, 210)[lod])
    envejecer(p, 7, musgo=0.85)
    b = bvh_de(p); X = []
    for s in (-1, 1):
        X += brasero(s * 4.55, 0, 2.52, lod, 0.52)
        if lod == 2:
            X.append(runa(b, 0, (s * 2.2, -0.6, 3.3), (0, -1, 0), 0.5, 3.2, VIO, 2))
            continue
        for f in (-1, 1):
            for k in range(3):
                X.append(runa(b, k + (3 if s > 0 else 0) + (1 if f > 0 else 0), (s * 2.2, f * 0.6, 1.95 + k * 1.3), (0, f, 0), 0.5, 0.8, VIO, lod))
    if lod < 2:
        for f in (-1, 1):
            X.append(runa(b, 7, (0, f * 0.25, 7.0), (0, f, 0), 1.1, 1.5, VIO, lod, grosor=0.11))
            X.append(runa(b, 2, (-1.1 * f, f * 0.25, 6.6), (0, f, 0), 0.5, 0.75, VIO, lod))
            X.append(runa(b, 5, (1.1 * f, f * 0.25, 6.6), (0, f, 0), 0.5, 0.75, VIO, lod))
    else:
        X.append(runa(b, 0, (0, -0.25, 7.0), (0, -1, 0), 1.0, 1.5, VIO, 2))
    if lod == 0:
        X.append(grieta(b, (-2.45, -0.6, 5.3), (0, -1, 0), 2.6, 3)); X.append(grieta(b, (3.3, -0.75, 4.0), (0, -1, 0), 2.2, 4))
        X.append(grieta(b, (0.5, -0.25, 7.9), (0, -1, 0), 1.3, 5)); X.append(grieta(b, (-4.4, -0.65, 2.1), (0, -1, 0), 1.5, 6))
        X.append(grieta(b, (2.35, 0.6, 4.6), (0, 1, 0), 2.4, 8))
        # Raices que trepan por el contrafuerte izquierdo y el pedestal derecho.
        X.append(raiz([(-5.2, -1.0, -0.3), (-4.3, -0.92, 0.9), (-3.9, -0.86, 2.3), (-3.3, -0.82, 3.6), (-3.25, -0.72, 5.2), (-2.9, -0.7, 6.9)], 0.17, 0))
        X.append(raiz([(-3.2, -1.3, -0.3), (-3.5, -0.88, 0.8), (-3.9, -0.86, 2.3)], 0.1, 0))
        X.append(raiz([(5.6, -0.3, -0.3), (5.17, -0.4, 0.7), (5.15, -0.1, 1.7), (4.9, 0.3, 2.3)], 0.11, 0))
    return cerrar(p, X, lod)


# ═══════════ MENHIRES DEL CLARO DEL TITAN ═══════════
def menhir(lod, alto, sem, ancho=2.05, fondo=1.18, ladeo=(0.04, 0.0), sesgo=0.5, k0=0, piedras=()):
    o = primitiva('cubo', marca='monolito', color=GRIS[sem % 4], lado=1.0)
    mover(o, (0, 0, alto / 2 - 0.35), esc=(ancho, fondo, alto + 0.7))
    biselar(o, 0.18, 2); subdividir(o, 3 if lod == 0 else 2, simple=True)
    def forma(P):
        t = np.clip(P[:, 2] / alto, 0, 1); Q = P.copy()
        Q[:, 0] *= 1 - 0.5 * t ** 1.3; Q[:, 1] *= 1 - 0.38 * t
        Q[:, 2] -= np.clip((P[:, 2] - alto * 0.72) / (alto * 0.28), 0, 1) * (P[:, 0] / (ancho / 2)) * sesgo       # cima sesgada
        Q[:, 0] += ladeo[0] * alto * t ** 2; Q[:, 1] += ladeo[1] * alto * t ** 2                                 # se ladea
        return Q
    deformar(o, forma)
    desplazar(o, 0.2, 0.5, semilla=sem); desplazar(o, 0.06, 2.0, semilla=sem + 5)
    S = [o] + [escombro(c, r, sem * 3 + i, lod) for i, (c, r) in enumerate(piedras) if lod < 2]
    p = unir(S)
    decimar(p, (600, 215, 80)[lod])
    envejecer(p, sem, musgo=0.8, pie=1.2)
    b = bvh_de(p); X = []
    for f in (-1, 1):
        if lod == 2 and f > 0: continue
        X.append(runa(b, k0 + (0 if f < 0 else 3), (ladeo[0] * alto * 0.25, f * 0.5, alto * 0.5), (0, f, 0), 0.62, 1.0, NAR, lod, grosor=0.095))
        if lod == 0: X.append(runa(b, k0 + (5 if f < 0 else 6), (ladeo[0] * alto * 0.5, f * 0.4, alto * 0.74), (0, f, 0), 0.36, 0.5, NAR, 0, grosor=0.065))
    if lod == 0: X.append(grieta(b, (-0.35, -0.6, alto * 0.42), (0, -1, 0), alto * 0.3, sem))
    return cerrar(p, X, lod)


@modelo('menhir_a', tris=(800, 280, 90))
def menhir_a(lod): return menhir(lod, 4.3, 3, ladeo=(-0.03, 0.01), sesgo=0.45, k0=0, piedras=[((1.2, -0.5, 0.05), 0.36)])


@modelo('menhir_b', tris=(800, 280, 90))
def menhir_b(lod): return menhir(lod, 5.5, 14, ancho=2.2, ladeo=(0.05, -0.012), sesgo=-0.6, k0=1, piedras=[((-1.25, 0.45, 0.05), 0.4), ((-0.9, -0.75, 0.02), 0.24)])


@modelo('menhir_c', tris=(800, 280, 90))
def menhir_c(lod): return menhir(lod, 6.7, 25, ancho=2.3, fondo=1.3, ladeo=(0.02, 0.02), sesgo=0.7, k0=2)


@modelo('columna_caida', tris=(420, 150, 50))
def columna_caida(lod):
    """Columna rota tumbada (junto a algunos menhires): dos tambores medio hundidos y un pedazo."""
    S = []
    for i, (x, L, r, rz, z) in enumerate([(-0.55, 1.45, 0.43, 0.0, 0.24), (0.85, 0.8, 0.41, 0.22, 0.17)]):
        if lod == 2 and i: continue
        t = primitiva('cono', marca='piedra', color=GRIS[i + 1], r1=r, r2=r * 0.94, alto=L if lod < 2 else 2.4, lados=(10, 7, 5)[lod])
        if lod == 0: biselar(t, 0.05, 1); subdividir(t, 1, simple=True)
        if lod < 2: desplazar(t, 0.05, 1.3, semilla=40 + i)
        mover(t, (x - L / 2 if lod < 2 else -1.2, 0.12 * i, z), (0, math.pi / 2 - 0.07, rz)); S.append(t)
    if lod < 2: S.append(escombro((0.2, 0.75, 0.02), 0.3, 44, lod)); S.append(escombro((1.5, -0.5, 0.0), 0.22, 45, lod))
    p = unir(S); decimar(p, (410, 145, 48)[lod])
    return envejecer(p, 31, musgo=0.95, pie=0.5)


# ═══════════ HITO DE ZONA ═══════════
@modelo('hito', tris=(1300, 430, 120), ao_dist=1.4)
def hito(lod):
    S = []
    for i, (r1, r2, z0, h, g) in enumerate([(1.85, 1.72, -0.7, 1.08, 0.0), (1.36, 1.26, 0.3, 0.38, 0.45)]):
        if lod == 2 and i: continue
        t = primitiva('cono', marca='piedra', color=GRIS[i + 1], r1=r1, r2=r2, alto=h + (0.3 if lod == 2 else 0), lados=(8, 7, 6)[lod])
        if lod == 0: biselar(t, 0.07, 1); subdividir(t, 1, simple=True)
        if lod < 2: desplazar(t, 0.06, 0.9, semilla=50 + i)
        mover(t, (0, 0, z0), (0, 0, g)); S.append(t)
    if lod < 2: S.append(bloque((0, 0, 0.84), (1.32, 1.32, 0.36), 53, lod, rot=(0, 0, 0.0)))
    # Fuste: aguja de una pieza que se afina; arriba, cuatro garras sostienen el cristal (que flota a 6,4 m).
    f = primitiva('cubo', marca='monolito', color=GRIS[2], lado=1.0)
    mover(f, (0, 0, 2.95), esc=(0.98, 0.98, 3.9))
    if lod == 0: biselar(f, 0.09, 1)
    if lod < 2: subdividir(f, 2 if lod == 0 else 1, simple=True)
    deformar(f, lambda P: np.c_[P[:, 0] * (1 - 0.4 * np.clip((P[:, 2] - 1.0) / 3.9, 0, 1)), P[:, 1] * (1 - 0.4 * np.clip((P[:, 2] - 1.0) / 3.9, 0, 1)), P[:, 2]])
    if lod < 2: desplazar(f, 0.05, 0.9, semilla=57)
    S.append(f)
    if lod < 2: S.append(bloque((0, 0, 4.98), (0.86, 0.86, 0.26), 58, lod, rot=(0, 0, 0.785)))
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2; d = np.array([math.cos(a), math.sin(a), 0.0])
        pts = [d * 0.26 + [0, 0, 4.85], d * 0.62 + [0, 0, 5.1], d * 0.74 + [0, 0, 5.5], d * 0.5 + [0, 0, 5.95]]
        if lod == 2: continue
        S.append(tubo(curva(pts, (6, 4)[lod]), np.linspace(0.15, 0.04, (6, 4)[lod]), (5, 4)[lod], 'garra', 'piedra', GRIS[3]))
    if lod == 0:
        S.append(escombro((1.25, 0.5, 0.42), 0.26, 59, 0)); S.append(escombro((-0.9, -1.15, 0.4), 0.2, 60, 0)); S.append(escombro((-1.75, 0.9, -0.1), 0.33, 61, 0))
    p = unir(S); decimar(p, (1010, 330, 100)[lod])
    envejecer(p, 52, musgo=0.75, pie=0.9)
    b = bvh_de(p); X = []
    for k in range(4):
        a = k * math.pi / 2; N = (round(math.cos(a)), round(math.sin(a)), 0)
        if lod == 2 and k % 2: continue
        X.append(runa(b, k + 2, (N[0] * 0.45, N[1] * 0.45, 2.0), N, 0.5, 0.8, CIAN, lod))
        if lod == 0: X.append(runa(b, k + 5, (N[0] * 0.38, N[1] * 0.38, 3.3), N, 0.38, 0.6, CIAN, 0, grosor=0.07))
    if lod == 0: X.append(grieta(b, (0.2, -0.5, 4.3), (0, -1, 0), 1.4, 9, ancho=0.035))
    return cerrar(p, X, lod)


# ═══════════ ARCO DE ENTRADA DEL PUEBLO ═══════════
# Pilares en Y = ±3,5 (la tangente del cerco); +X mira hacia fuera del pueblo y -X hacia la plaza.
@modelo('arco_camino', tris=(2600, 900, 260), ao=0.8)
def arco_camino(lod):
    S = []; X = []
    for s in (-1, 1):
        y = s * 3.5
        if lod < 2: S.append(bloque((0, y, 0.25), (1.66, 1.66, 1.1), 100 + s, lod))
        S += pila(0, y, 0.8 if lod < 2 else -0.3, 1.12, 1.12, [0.95, 0.8, 1.0, 0.75, 0.6] if lod < 2 else [5.2], 110 + s, lod)
        S.append(bloque((0, y, 5.06), (1.46, 1.46, 0.36), 120 + s, lod))
        if lod < 2:
            S.append(bloque((0, y - s * 0.86, 4.62), (0.86, 0.62, 0.5), 124 + s, lod, rot=(s * 0.35, 0, 0)))    # mensula bajo la viga
            S.append(escombro((0.95 * s, y + s * 0.9, 0.04), 0.3, 126 + s, lod))
    p = unir(S); decimar(p, (1250, 400, 110)[lod])
    envejecer(p, 101, musgo=0.8)
    b = bvh_de(p)
    # Viga de roble, pendolon y tejadillo de tejas a dos aguas.
    X.append(bloque((0, 0, 5.47), (0.52, 8.9, 0.46), 130, lod, marca='madera', color=MADERA, rug=0.025, sub=0))
    if lod < 2: X.append(bloque((0, 0, 5.95), (0.34, 0.34, 0.6), 131, lod, marca='madera', color=MADERA, rug=0.0))
    filas = (3, 2, 1)[lod]
    for s in (-1, 1):
        for i in range(filas):
            u = (i + 0.5) / filas; ancho = 1.5 / filas + 0.12
            X.append(bloque((s * (0.14 + 1.22 * u * 0.82), 0, 6.5 - 0.88 * u + (filas - 1 - i) * 0.02), (ancho, 9.4 - i * 0.08, 0.1), 140 + i, lod, rot=(0, s * 0.62, 0), bis=0.025, rug=0.02, marca='teja', color=['#6d3524', '#62301f', '#743b28'][i % 3]))
    if lod < 2: X.append(bloque((0, 0, 6.56), (0.2, 9.5, 0.18), 150, lod, marca='madera', color='#3a2c20', rug=0.0, bis=0.03))
    # Estandartes colgados de la viga, con la punta en pico y un pliegue.
    for s in (-1, 1):
        n = (5, 3, 2)[lod]; V = []; C = []
        for j in range(n):
            v = j / (n - 1)
            for u in (-0.55, 0.0, 0.55):
                pico = 0.55 * (1 - abs(u) / 0.55) if j == n - 1 else 0.0
                V.append((0.07 * math.sin(v * 3.2 + u * 2 + s), s * 1.7 + u, 5.2 - v * 1.72 - pico))
        for j in range(n - 1):
            for i in range(2): a = j * 3 + i; C.append((a, a + 1, a + 4, a + 3))
        t = malla('tela', V, C, 'liso', '#4a2470' if s < 0 else '#7a1f30')
        degradar(t, '#2f1748' if s < 0 else '#4d1420', '#5a2c86' if s < 0 else '#8f2538', 3.0, 5.2)
        dos_caras(t); suavizar(t, 60); X.append(t)
        if lod == 0:   # ribete dorado apagado arriba
            X.append(bloque((0, s * 1.7, 5.2), (0.07, 1.2, 0.07), 160, 0, marca='liso', color='#8a6a2a', rug=0.0, bis=0.0))
    # Antorchas de hierro en la cara que mira a la plaza (la llama la pone el juego a 3,22 m).
    for s in (-1, 1):
        y = s * 3.5
        if lod < 2: X.append(tubo(curva([(-0.5, y, 1.75), (-0.7, y, 1.95), (-0.72, y, 2.4), (-0.72, y, 2.82)], 5), 0.045, 4, 'brazo', 'liso', HIERRO, punta=False))
        copa = mover(primitiva('cono', marca='liso', color=HIERRO, r1=0.09, r2=0.18, alto=0.26, lados=(7, 5, 4)[lod]), (-0.72, y, 2.78))
        asc = mover(primitiva('cono', marca='emisivo', color=BRASA, r1=0.14, r2=0.0, alto=0.34, lados=(6, 5, 4)[lod]), (-0.72, y, 2.98))
        suavizar(copa, 30); suavizar(asc, 30); X += [copa, asc]
        X.append(runa(b, (2 if s < 0 else 6), (0.56, y, 2.4), (1, 0, 0), 0.45, 0.72, VIO, lod))
        if lod == 0: X.append(runa(b, (4 if s < 0 else 1), (0.56, y, 3.55), (1, 0, 0), 0.36, 0.55, VIO, 0, grosor=0.07))
    if lod == 0:
        X.append(grieta(b, (0.2, 3.5 - 0.56, 4.3), (0, -1, 0), 2.0, 12)); X.append(grieta(b, (-0.56, -3.4, 4.5), (-1, 0, 0), 1.8, 13))
        X.append(raiz([(1.3, 4.3, -0.3), (0.75, 3.95, 0.7), (0.62, 3.6, 2.0), (0.6, 3.2, 3.3), (0.3, 2.9, 4.5), (0.3, 2.2, 5.2)], 0.13, 0))
        X.append(raiz([(0.9, 2.6, -0.3), (0.62, 3.1, 0.9), (0.62, 3.6, 2.0)], 0.08, 0))
    return cerrar(p, X, lod)


# ═══════════ MURETE EN RUINAS (tramos de 2,95 m a lo largo de Y; grueso 0,75) ═══════════
def murete(lod, sem, hiladas, caidos=(), machon=None):
    """hiladas: por hilada, lista de (y0, y1) con los sillares que quedan en pie."""
    rng = azar(sem); S = []; z = -0.32
    if lod == 2:
        alto = 0.5 + 0.4 * (len(hiladas) - 1)
        S.append(bloque((0, 0, z + alto / 2), (0.74, 2.9, alto), sem, 2))
        if machon: S.append(bloque((0, machon, 0.6), (0.9, 0.9, 1.9), sem + 1, 2))
    else:
        for j, fila in enumerate(hiladas):
            h = 0.78 if j == 0 else rng.uniform(0.36, 0.44)
            for i, (y0, y1) in enumerate(fila):
                S.append(bloque((rng.uniform(-0.04, 0.04), (y0 + y1) / 2, z + h / 2), (0.74 * rng.uniform(0.93, 1.05), y1 - y0 - 0.03, h - 0.02), sem * 5 + j * 7 + i, lod,
                                rot=(0, 0, rng.uniform(-0.05, 0.05) * (1 + j)), bis=0.055))
            z += h
        for i, (x, y, t, r) in enumerate(caidos): S.append(bloque((x, y, t[2] * 0.2), t, sem * 3 + i, lod, rot=r))
        if machon:
            S += pila(0, machon, -0.32, 0.92, 0.92, [0.8, 0.5, 0.45, 0.32], sem + 60, lod, giro=0.07)
    p = unir(S); decimar(p, (520, 180, 56)[lod])
    envejecer(p, sem, musgo=0.75, pie=0.3, vetas=False)
    if lod == 0 and machon is None:
        p = cerrar(p, [grieta(bvh_de(p), (0.375, 0.3, 0.42), (1, 0, 0), 0.5, sem, ancho=0.03)], 0)
    return p


@modelo('murete_a', tris=(540, 190, 60), ao=0.6, ao_dist=0.8)
def murete_a(lod):
    return murete(lod, 71, [[(-1.47, -0.5), (-0.5, 0.55), (0.55, 1.47)], [(-1.47, -0.85), (-0.85, 0.1), (0.1, 0.95)], [(-1.4, -0.6), (-0.45, 0.3)]],
                  caidos=[(0.72, 1.05, (0.55, 0.7, 0.4), (0.25, 0.1, 0.5)), (-0.7, 0.4, (0.4, 0.5, 0.34), (0.1, 0.3, 1.1))])


@modelo('murete_b', tris=(540, 190, 60), ao=0.6, ao_dist=0.8)
def murete_b(lod):
    return murete(lod, 82, [[(-1.47, -0.45), (-0.45, 0.5), (0.5, 1.47)], [(-1.2, -0.3), (0.55, 1.47)], [(0.75, 1.4)]],
                  caidos=[(0.8, -0.2, (0.6, 0.75, 0.4), (0.3, -0.15, -0.4)), (-0.75, -0.9, (0.45, 0.5, 0.36), (0.2, 0.2, 0.8)), (0.62, 0.9, (0.36, 0.4, 0.3), (0.5, 0.1, 0.2))])


@modelo('murete_c', tris=(540, 190, 60), ao=0.6, ao_dist=0.8)
def murete_c(lod):
    return murete(lod, 93, [[(-1.47, -0.4), (-0.4, 0.45), (0.45, 1.02)], [(-1.47, -0.7), (-0.7, 0.3)]],
                  caidos=[(-0.72, 0.2, (0.5, 0.62, 0.38), (0.2, 0.1, 0.3))], machon=1.03)


# ═══════════ PORTAL MENOR: trilito de las entradas (salida de la Cueva, portales del Abismo) ═══════════
# Vano de 3,1 × 4,5 m (el velo del juego mide 3 × 4,4).
@modelo('portal_menor', tris=(1500, 520, 150), ao=0.8)
def portal_menor(lod):
    S = []
    for s in (-1, 1):
        j = bloque((s * 2.12, 0, 2.1), (1.12, 1.05, 5.0), 200 + s, lod, rot=(0, -s * 0.035, 0), bis=0.12, sub=2, rug=0.11, marca='monolito')
        S.append(j)
        if lod < 2:
            S.append(bloque((s * 2.95, 0.05, 0.2), (0.9, 1.2, 1.3), 204 + s, lod, rot=(0, s * 0.12, 0.1)))       # cuña al pie
            S.append(escombro((s * 3.4, -0.6, 0.05), 0.36, 206 + s, lod))
    S.append(bloque((0.05, 0, 5.1), (6.0, 1.2, 1.08), 210, lod, rot=(0, 0.025, 0), bis=0.14, sub=2, rug=0.1, marca='monolito'))     # dintel
    if lod < 2:
        S.append(bloque((-1.9, 0.02, 5.86), (1.3, 0.95, 0.5), 211, lod, rot=(0, -0.06, 0.05)))
        S.append(bloque((0.9, -0.03, 5.83), (1.0, 0.9, 0.42), 212, lod, rot=(0, 0.05, -0.08)))
        S.append(bloque((0, 0, -0.04), (3.2, 1.5, 0.2), 213, lod, bis=0.04))
    p = unir(S); decimar(p, (1020, 370, 110)[lod])
    envejecer(p, 201, musgo=0.6, pie=0.8)
    b = bvh_de(p); X = []
    for f in (-1, 1):
        if lod == 2 and f > 0: continue
        for s in (-1, 1):
            for k in range(3 if lod < 2 else 1):
                X.append(runa(b, k * 2 + (1 if s > 0 else 0) + (3 if f > 0 else 0), (s * 2.1, f * 0.55, (1.2 + k * 1.15) if lod < 2 else 2.3), (0, f, 0), 0.44, 0.72 if lod < 2 else 2.6, VIO, lod))
        if lod < 2:
            for k in range(5): X.append(runa(b, k + (0 if f < 0 else 4), ((k - 2) * 0.95, f * 0.6, 5.1), (0, f, 0), 0.42, 0.62, VIO, lod, grosor=0.075))
    if lod == 0:
        X.append(grieta(b, (0.6, -0.6, 5.55), (0, -1, 0), 0.9, 21)); X.append(grieta(b, (-2.3, -0.55, 4.3), (0, -1, 0), 1.6, 22))
        X.append(raiz([(3.3, -0.9, -0.3), (2.75, -0.62, 0.8), (2.5, -0.6, 2.2), (2.2, -0.62, 3.4), (2.0, -0.66, 4.7), (1.4, -0.66, 5.4)], 0.12, 0))
    return cerrar(p, X, lod)


# ═══════════ PUERTA DEL NUCLEO (sustituye a la reja del kit) ═══════════
# Se modela en metros (4,45 de ancho × 5,84 de alto × 0,58 de grueso) y al final se pasa a las unidades de la pieza
# `c_metal-gate` del kit (el juego la estira ×8 a lo alto y a lo grueso y ×6,4 a lo ancho).
@modelo('puerta_nucleo', sustituye={'kit': 'c_metal-gate'}, tris=(950, 320, 110), lods='decimar', ao=0.6, ao_dist=0.16)
def puerta_nucleo(lod):
    S = []
    for s in (-1, 1): S += pila(0, s * 1.98, 0, 0.56, 0.46, [1.3, 1.1, 1.25, 1.05], 300 + s, 0, giro=0.0)
    S.append(bloque((0, 0, 5.27), (0.575, 4.44, 1.12), 310, 0, bis=0.05, rug=0.02))
    p = unir(S); envejecer(p, 301, musgo=0.0)
    X = []
    for i in range(6):
        y = -1.45 + i * 0.58
        X.append(bloque((0, y, 2.36), (0.13, 0.13, 4.72), 320 + i, 0, bis=0.0, rug=0.0, marca='liso', color=HIERRO))
    for i, z in enumerate([0.7, 1.75, 3.45, 4.5]):
        X.append(bloque((0, 0, z), (0.19, 3.6, 0.16), 330 + i, 0, bis=0.0, rug=0.0, marca='liso', color='#2b2b31'))
    sello = primitiva('cono', marca='liso', color='#3d3d45', r1=0.62, r2=0.62, alto=0.26, lados=10)
    mover(sello, (-0.13, 0, 2.6), (0, math.pi / 2, 0)); suavizar(sello, 30); X.append(sello)
    b = bvh_de(unir([copiar(p), copiar(sello)]))
    for f in (-1, 1):
        X.append(runa(b, 7, (f * 0.13, 0, 2.6), (f, 0, 0), 0.62, 0.86, VIO, 1, grosor=0.1))
        for k in range(5): X.append(runa(b, k + (0 if f < 0 else 3), (f * 0.29, (k - 2) * 0.8, 5.27), (f, 0, 0), 0.4, 0.62, VIO, 1, grosor=0.09))
    o = unir([p] + X)
    return mover(o, esc=(1 / 8, 1 / 6.4, 1 / 8))
