# ═══════════════════════════════════════════════════════
# DUENDE QUEST — familia OBJETOS («medieval mistico»): mobiliario y enseres del pueblo.
# Diseños propios, generados por guion. Madera oscura con herrajes de hierro, piedra envejecida con musgo,
# barro cocido; los unicos acentos son emisivos (brasa ambar, chicha violeta).
# Convenciones (GUIA.md): metros, Z arriba, FRENTE hacia -Y (en el juego, +Z), origen en el suelo y en el centro.
# Los tres niveles salen de la misma funcion: N(a, b, c) elige cuanta malla lleva cada uno.
# Los coloca mundo/js/mundo.js por nombre (crearPuebloKit, crearPuestosVecinos, crearCofres3): no declaran `sustituye`.
# ═══════════════════════════════════════════════════════
import math
import numpy as np
from dq_lib import *

MADERA = '#54432f'; MADERA_OSC = '#3b2e22'; MADERA_CLARA = '#6e5a40'
HIERRO = '#302f31'; HIERRO_CLARO = '#56555a'
PIEDRA = '#858178'; PIEDRA_OSC = '#66625b'
BARRO = '#7a4a30'; MUSGO = '#34421f'
BRASA = '#ffb45a'; VIOLETA = '#8a5cf0'
ORO = '#c79a34'

_L = [0]


def N(a, b, c):
    """Valor segun el nivel de detalle que se esta construyendo (alto, medio, bajo)."""
    return (a, b, c)[_L[0]]


def objeto(nombre, tris, **k):
    """Como @modelo, pero deja el nivel a mano de N()."""
    def deco(fn):
        def f(lod):
            _L[0] = lod
            return fn()
        return modelo(nombre, tris=tris, **k)(f)
    return deco


# ── piezas ──
def caja(dx, dy, dz, loc=(0, 0, 0), rot=(0, 0, 0), marca='madera', color=MADERA, bisel=0.0, tono=0.0, semilla=0):
    """Caja centrada en loc. bisel: solo en el nivel alto. tono: variacion de color entre sus esquinas."""
    o = primitiva('cubo', marca=marca, color=color, lado=1.0)
    mover(o, esc=(dx, dy, dz))
    if bisel and _L[0] == 0: biselar(o, min(bisel, min(dx, dy, dz) * 0.3), 1)
    mover(o, loc, rot)
    if tono: variar(o, tono, 1.7, semilla)
    return o


def tablas(n, largo, ancho, grosor, loc=(0, 0, 0), eje='x', color=MADERA, semilla=0, hueco=0.012, bisel=0.012, marca='madera', juntas=None):
    """n tablas una junto a otra formando un tablero de `ancho` (cada una de un tono). eje: hacia donde corren ('x' o 'y').
    En los niveles medio y bajo es UNA tabla (con el tono medio)."""
    rng = azar(semilla + 100)
    if _L[0] > 0: n = 1
    w = ancho / n; out = []
    for i in range(n):
        c = hexlin(color) * rng.uniform(0.78, 1.18); d = (i + 0.5) * w - ancho / 2
        L = largo * (1 if n == 1 else rng.uniform(0.985, 1.0))
        if eje == 'x': o = caja(L, w - hueco, grosor, (loc[0], loc[1] + d, loc[2]), marca=marca, color=c, bisel=bisel, tono=0.14, semilla=semilla + i)
        else: o = caja(w - hueco, L, grosor, (loc[0] + d, loc[1], loc[2]), marca=marca, color=c, bisel=bisel, tono=0.14, semilla=semilla + i)
        out.append(o)
    return out


def torno(perfil, lados=12, marca='liso', color='#888888', loc=(0, 0, 0), fase=0.0, esc=(1, 1)):
    """Solido de revolucion alrededor de Z. perfil: [(radio, z)...]; con radio 0 en un extremo cierra en un vertice.
    Trazado de abajo arriba por fuera da caras hacia fuera; si luego baja por dentro, esas miran hacia el eje (un cuenco)."""
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


def aro(r, z, alto=0.05, grueso=0.012, lados=12, color=HIERRO, marca='liso', fase=0.0, esc=(1, 1)):
    """Fleje (aro de hierro) alrededor de Z."""
    if _L[0] == 0: p = [(r, z), (r + grueso, z), (r + grueso, z + alto), (r, z + alto)]
    else: p = [(r + grueso, z), (r + grueso, z + alto)]
    return torno(p, lados, marca, color, fase=fase, esc=esc)


def barra(a, b, r=0.03, lados=4, marca='liso', color=HIERRO, punta=False, tapa=False):
    """Barra recta de a a b."""
    return tubo([a, b], r, lados, 'barra', marca, color, punta=punta, tapa_base=tapa)


def arco_pts(c, r, a0, a1, n, plano='xz'):
    """n puntos de un arco de circulo (angulos en radianes) en el plano 'xz' o 'yz' o 'xy'."""
    out = []
    for t in np.linspace(a0, a1, n):
        u, v = math.cos(t) * r, math.sin(t) * r
        out.append((c[0] + u, c[1], c[2] + v) if plano == 'xz' else (c[0], c[1] + u, c[2] + v) if plano == 'yz' else (c[0] + u, c[1] + v, c[2]))
    return out


def piedra_suelta(r, loc, semilla, color=PIEDRA, esc=(1, 1, 0.7), marca='monolito', sub=2):
    """Canto rodado irregular."""
    o = esfera(loc, r, N(sub, 1, 1), esc, marca=marca, color=color)
    if _L[0] < 2: desplazar(o, r * 0.35, 1.3 / r, semilla)
    variar(o, 0.25, 2.0 / r, semilla)
    o['dq_afilado'] = 1
    return o


def sillares(r, n, ancho, alto, z, semilla=0, color=PIEDRA, bisel=0.035, marca='piedra', desfase=0.0, caer=0.0):
    """Hilada circular de n sillares (bloques de piedra algo desiguales) de radio medio r."""
    rng = azar(semilla + 7); out = []
    if _L[0] == 2:   # de lejos: un anillo liso con el color medio
        o = torno([(r - ancho / 2, z), (r + ancho / 2, z), (r + ancho / 2 - caer, z + alto), (r - ancho / 2, z + alto)], max(6, n // 2), marca, color, fase=desfase)
        variar(o, 0.2, 1.5, semilla); return [o]
    for i in range(n):
        a = 2 * math.pi * (i + 0.5) / n + desfase; largo = 2 * math.pi * r / n * rng.uniform(0.93, 0.985)
        h = alto * rng.uniform(0.94, 1.03); w = ancho * rng.uniform(0.94, 1.04)
        o = primitiva('cubo', marca=marca, color=hexlin(color) * rng.uniform(0.68, 1.12) * np.array([1.0 + rng.uniform(-0.03, 0.05), 1.0, 1.0 - rng.uniform(0, 0.07)]), lado=1.0)
        mover(o, esc=(w, largo, h))
        k = largo / (2 * r)   # en cuña: mas ancho por fuera
        deformar(o, lambda P: np.stack([P[:, 0], P[:, 1] * (1 + P[:, 0] / w * 2 * k * (w / largo) * 1.0), P[:, 2]], axis=1))
        if _L[0] == 0 and bisel: biselar(o, bisel, 1)
        mover(o, (r - caer * 0.5, 0, z + h / 2), (0, rng.uniform(-0.02, 0.02) - math.atan2(caer, alto), 0))
        mover(o, rot=(0, 0, a))
        variar(o, 0.22, 2.2, semilla + i)
        out.append(o)
    return out


def envejecer(o, musgo=0.0, base=0.25, z_musgo=0.5, luz=0.3, sombra=0.25, sem=3):
    """Acabado comun: suciedad hacia el suelo, musgo opcional en lo que mira arriba y cerca del suelo, cantos gastados."""
    if base: pintar_fn(o, lambda P, Nn, C: C * (1 - base * np.clip(1 - P[:, 2] / 0.5, 0, 1) ** 1.5)[:, None])
    if musgo: manchar(o, MUSGO, lambda P, Nn: (Nn[:, 2] * 0.9 + np.clip(z_musgo - P[:, 2], 0, 1) * 1.1) * musgo, 0.85, 2.6, sem)
    return o


# ═══════════════ COFRES (caja y tapa por separado: la tapa gira en su bisagra) ═══════════════
# Medidas del cofre de siempre: 1,10 × 0,75 × 0,60 y tapa abovedada de radio 0,375. Bisagra en (0, +0,375, 0,60).
COFRES = {
    'madera': dict(cuerpo=MADERA, herraje=HIERRO, clavo=HIERRO_CLARO, gema=None, marca='madera', interior='#2a2019'),
    'hierro': dict(cuerpo='#4a4a54', herraje='#26262c', clavo='#8d8d98', gema=VIOLETA, marca='liso', interior='#1d1d22'),
    'dorado': dict(cuerpo='#4d2a1d', herraje=ORO, clavo='#f0cf6a', gema=BRASA, marca='madera', interior='#2a1712'),
}


def _cofre_base(tipo):
    K = COFRES[tipo]; W, D, H, G = 1.10, 0.75, 0.60, 0.05; p = []
    if _L[0] == 2:   # de lejos: el bulto, dos flejes y las patas
        p.append(caja(W - 0.02, D, H - 0.06, (0, 0, 0.06 + (H - 0.06) / 2), marca=K['marca'], color=K['cuerpo'], tono=0.16))
        for sx in (-0.36, 0.36): p.append(caja(0.1, D + 0.03, H - 0.04, (sx, 0, 0.05 + (H - 0.05) / 2), marca='liso', color=K['herraje']))
        for sx in (-1, 1): p.append(caja(0.12, D + 0.03, 0.4, (sx * (W / 2 - 0.1), 0, -0.14), marca=K['marca'], color=hexlin(K['cuerpo']) * 0.7))
        return suavizar(envejecer(unir(p, 'cofre'), base=0.3), 40)
    # paredes de tablas (delante y detras, dos tablas; costados, una)
    for sy in (-1, 1):
        for i, (z0, z1) in enumerate(((0.06, 0.33), (0.335, H)) if _L[0] == 0 else ((0.06, H),)):
            p.append(caja(W - 0.02, G, z1 - z0 - 0.008, (0, sy * (D / 2 - G / 2), (z0 + z1) / 2), marca=K['marca'], color=hexlin(K['cuerpo']) * (1.0 + 0.12 * i - 0.05 * sy), bisel=0.012, tono=0.16, semilla=i + sy))
    for sx in (-1, 1):
        p.append(caja(G, D - 2 * G, H - 0.068, (sx * (W / 2 - G / 2 - 0.01), 0, 0.06 + (H - 0.06) / 2), marca=K['marca'], color=hexlin(K['cuerpo']) * 0.92, tono=0.16, semilla=5 + sx))
    p.append(caja(W - 0.02, D, 0.05, (0, 0, 0.085), marca=K['marca'], color=hexlin(K['cuerpo']) * 0.8))   # fondo
    # interior oscuro y el tesoro: un monton de monedas que asoma al abrir
    p.append(caja(W - 2 * G - 0.03, D - 2 * G - 0.01, 0.02, (0, 0, 0.36), marca='liso', color=K['interior']))
    if _L[0] < 2:
        m = torno([(0.36, 0.37), (0.3, 0.45), (0.16, 0.52), (0, 0.545)], N(9, 6, 5), 'liso', '#d9a92e', esc=(1.25, 0.72))
        if _L[0] == 0: desplazar(m, 0.035, 9.0, 4)
        variar(m, 0.35, 14.0, 2); p.append(m)
    # flejes que abrazan la caja (delante, debajo no se ve, detras) y cantoneras
    for sx in (-0.36, 0.36):
        for sy in (-1, 1):
            p.append(caja(0.1, 0.014, H - 0.05, (sx, sy * (D / 2 + 0.006), 0.05 + (H - 0.05) / 2), marca='liso', color=K['herraje'], bisel=0.006))
    if _L[0] < 2:
        for sx in (-1, 1):
            for sy in (-1, 1):
                p.append(caja(0.075, 0.075, H - 0.02, (sx * (W / 2 - 0.022), sy * (D / 2 - 0.018), 0.03 + (H - 0.02) / 2), marca='liso', color=hexlin(K['herraje']) * 0.9))
        # cerradura
        p.append(caja(0.2, 0.02, 0.2, (0, -D / 2 - 0.012, 0.46), marca='liso', color=K['herraje'], bisel=0.012))
        p.append(caja(0.05, 0.012, 0.07, (0, -D / 2 - 0.026, 0.45), marca='liso', color='#101014'))
    if _L[0] == 0:   # clavos y asas
        for sx in (-0.36, 0.36):
            for z in (0.14, 0.3, 0.52):
                p.append(caja(0.035, 0.014, 0.035, (sx, -D / 2 - 0.017, z), (0, 0.78, 0), marca='liso', color=K['clavo']))
        for sx in (-1, 1):
            p.append(tubo(arco_pts((sx * (W / 2 + 0.005), 0, 0.42), 0.09, math.pi, 2 * math.pi, 5, 'yz'), 0.014, 4, 'asa', 'liso', K['herraje'], punta=False))
    # patas
    for sx in (-1, 1):
        p.append(caja(0.12, D + 0.03, 0.4, (sx * (W / 2 - 0.1), 0, -0.14), marca=K['marca'], color=hexlin(K['cuerpo']) * 0.7))
    o = unir(p, 'cofre')
    envejecer(o, base=0.3)
    desgastar(o, 0.35, 0.3)
    return suavizar(o, 40)


def _cofre_tapa(tipo):
    """Origen en la bisagra. La tapa va de y = 0 (bisagra) a y = -0,75 (frente) y sube 0,375."""
    K = COFRES[tipo]; W, R = 1.12, 0.375; n = N(8, 5, 3); cy = -R
    cuerpo = hexlin(K['cuerpo'])
    # boveda maciza de duelas: cada duela, su tono
    verts = []; caras = []
    for sx in (-1, 1):
        for i in range(n + 1):
            a = math.pi * i / n; verts.append((sx * W / 2, cy + math.cos(a) * R, math.sin(a) * R * 0.92))
    for i in range(n): caras.append((i, i + 1, n + 2 + i, n + 1 + i))                      # por fuera
    caras.append(tuple(range(n + 1)))                                                      # testero -x
    caras.append(tuple(range(2 * n + 1, n, -1)))                                           # testero +x
    caras.append((0, n + 1, 2 * n + 1, n))                                                 # por debajo
    o = malla('tapa', verts, caras, K['marca'], cuerpo)
    P = pos(o); ang = np.arctan2(P[:, 2], P[:, 1] - cy); t = np.round(ang / math.pi * n)
    poner_color(o, cuerpo[None, :] * (0.86 + 0.22 * ((t * 7 + 3) % 4) / 3)[:, None])
    p = [o]
    p.append(caja(W - 0.12, 2 * R - 0.1, 0.012, (0, cy, -0.004), marca='liso', color=K['interior']))   # forro por dentro
    # flejes sobre la boveda
    m = N(8, 5, 3)
    for sx in (-0.36, 0.36):
        v = []; c = []
        for i in range(m + 1):
            a = math.pi * i / m
            for dx in (-0.05, 0.05): v.append((sx + dx, cy + math.cos(a) * (R + 0.012), math.sin(a) * (R * 0.92 + 0.012)))
        for i in range(m): c.append((2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1))
        f = malla('fleje', v, c, 'liso', K['herraje']); p.append(f)
        if _L[0] == 0:
            for i in (2, 4, 6):
                a = math.pi * i / m
                p.append(caja(0.035, 0.035, 0.016, (sx, cy + math.cos(a) * (R + 0.018), math.sin(a) * (R * 0.92 + 0.018)), (a - math.pi / 2, 0, 0.78), marca='liso', color=K['clavo']))
    if _L[0] < 2:
        # cantos de hierro en los testeros y aldaba que cae sobre la cerradura
        for sx in (-1, 1): p.append(caja(0.022, 2 * R + 0.02, 0.05, (sx * (W / 2 + 0.002), cy, 0.022), marca='liso', color=hexlin(K['herraje']) * 0.9))
        p.append(caja(W + 0.01, 0.022, 0.05, (0, -2 * R - 0.004, 0.024), marca='liso', color=hexlin(K['herraje']) * 0.9))
        p.append(caja(0.11, 0.02, 0.17, (0, -2 * R - 0.02, -0.03), marca='liso', color=K['clavo'], bisel=0.008))
    if K['gema'] and _L[0] < 2:
        g = esfera((0, cy - R * 0.72, R * 0.72), 0.07, 1, (1, 0.6, 1), marca='emisivo', color=K['gema']); mover(g, rot=(0, 0, 0)); p.append(g)
        p.append(aro(0.062, 0, 0.02, 0.02, 6, K['clavo']) if False else caja(0.2, 0.03, 0.2, (0, cy - R * 0.68, R * 0.66), (0.8, 0, 0.78), marca='liso', color=K['herraje']))
    o = unir(p, 'cofre_tapa')
    desgastar(o, 0.35, 0.3)
    return suavizar(o, 40)


for _t in COFRES:
    objeto('cofre_%s_base' % _t, (720, 250, 80), ao_dist=0.9)(lambda t=_t: _cofre_base(t))
    objeto('cofre_%s_tapa' % _t, (330, 135, 50), ao_dist=0.6, suelo=False)(lambda t=_t: _cofre_tapa(t))


# ═══════════════ FAROL DE HIERRO (3,4 m; la llama del juego va en el centro de la jaula, a 2,95 m) ═══════════════
@objeto('farol', (560, 240, 90), ao_dist=1.0)
def farol():
    p = []
    # basa de piedra
    b = caja(0.5, 0.5, 0.5, (0, 0, 0.0), marca='piedra', color=PIEDRA, bisel=0.05); variar(b, 0.25, 3.0, 1); p.append(b)
    b = caja(0.36, 0.36, 0.14, (0, 0, 0.32), marca='piedra', color=PIEDRA_OSC, bisel=0.03); p.append(b)
    # poste de hierro forjado, con un nudo a media altura
    L = N(8, 6, 4)
    p.append(torno([(0.085, 0.38), (0.06, 0.5), (0.05, 1.5), (0.075, 1.56), (0.075, 1.62), (0.045, 1.7), (0.04, 2.52), (0.07, 2.6), (0.07, 2.64)] if _L[0] < 2 else [(0.07, 0.38), (0.045, 2.64)], L, 'liso', HIERRO))
    # jaula: plato, cuatro barrotes, tejadillo y remate
    p.append(torno([(0.07, 2.62), (0.27, 2.66), (0.27, 2.7), (0, 2.7)], N(8, 4, 4), 'liso', HIERRO, fase=math.pi / 4))
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2; x, y = math.cos(a) * 0.245, math.sin(a) * 0.245
        p.append(barra((x, y, 2.7), (x * 1.08, y * 1.08, 3.2), 0.017, N(4, 3, 3), color=HIERRO))
    p.append(torno([(0.36, 3.17), (0.33, 3.21), (0.1, 3.36), (0.05, 3.38), (0.05, 3.43), (0, 3.47)] if _L[0] < 2 else [(0.36, 3.17), (0.08, 3.38), (0, 3.45)], 4, 'liso', HIERRO_CLARO, fase=math.pi / 4))
    if _L[0] == 0:
        # travesaños a media jaula y cuenco de la vela
        for k in range(4):
            a0 = math.pi / 4 + k * math.pi / 2; a1 = a0 + math.pi / 2
            p.append(barra((math.cos(a0) * 0.26, math.sin(a0) * 0.26, 3.17), (math.cos(a1) * 0.26, math.sin(a1) * 0.26, 3.17), 0.013, 3, color=HIERRO))
        p.append(torno([(0.05, 2.7), (0.09, 2.74), (0.07, 2.77), (0, 2.77)], 6, 'liso', '#8a7a5a'))
    if _L[0] < 2:
        # volutas bajo la jaula
        for k in range(N(4, 2, 0)):
            a = k * (math.pi / 2 if _L[0] == 0 else math.pi); d = np.array([math.cos(a), math.sin(a), 0])
            pts = [d * 0.05 + [0, 0, 2.2], d * 0.2 + [0, 0, 2.32], d * 0.24 + [0, 0, 2.5], d * 0.14 + [0, 0, 2.62]]
            p.append(tubo(curva(pts, N(6, 4, 3)), 0.014, 3, 'voluta', 'liso', HIERRO, punta=False))
    o = unir(p, 'farol')
    pintar_fn(o, lambda P, Nn, C: C * (1 + 0.25 * np.clip(ruido_fbm(P, 3.0, 2), -1, 1))[:, None])
    manchar(o, MUSGO, lambda P, Nn: (0.9 - P[:, 2] * 1.6) * (Nn[:, 2] * 0.5 + 0.7), 0.7, 5.0, 3)
    manchar(o, '#6b3a22', lambda P, Nn: (P[:, 2] > 0.4) * (0.42 + 0.3 * ruido_fbm(P, 2.4, 9)), 0.45, 6.0, 4)   # oxido
    desgastar(o, 0.4, 0.3)
    return suavizar(o, 40)


# ═══════════════ BARRIL y CAJON ═══════════════
def _barril(loc=(0, 0, 0), rot=(0, 0, 0), alto=0.95, r=0.31, semilla=0, tapa=True):
    L = N(12, 8, 6); pz = [0, 0.04, 0.25, 0.5, 0.75, 0.96, 1.0]; bz = [0.86, 0.9, 0.99, 1.04, 0.99, 0.9, 0.86]
    if _L[0] == 2: pz = [0, 0.5, 1.0]; bz = [0.88, 1.04, 0.88]
    perfil = [(r * b, alto * z) for z, b in zip(pz, bz)]
    perfil += [(r * 0.8, alto), (r * 0.8, alto - 0.035), (0, alto - 0.035)] if tapa and _L[0] < 2 else [(0, alto)]
    perfil = [(0, 0)] + perfil
    o = torno(perfil, L, 'madera', MADERA)
    rng = azar(semilla + 40); P = pos(o); k = np.round((np.arctan2(P[:, 1], P[:, 0]) / (2 * math.pi) * L)).astype(int) % L
    tonos = rng.uniform(0.78, 1.2, L); C = hexlin(MADERA)[None, :] * tonos[k][:, None]
    C[(np.hypot(P[:, 0], P[:, 1]) < r * 0.82) & (P[:, 2] > alto * 0.9)] = hexlin(MADERA_OSC) * 1.1
    poner_color(o, C)
    p = [o]
    if _L[0] < 2:
        for z, b in ((0.1, 0.895), (0.33, 1.0), (0.62, 1.0), (0.86, 0.9)) if _L[0] == 0 else ((0.12, 0.9), (0.84, 0.91)):
            p.append(torno([(r * b + 0.012, alto * z), (r * b + 0.012, alto * z + 0.045)], L, 'liso', HIERRO))
    o = unir(p, 'barril')
    return mover(o, loc, rot)


def _cajon(dx=0.6, dy=0.5, dz=0.45, loc=(0, 0, 0), rz=0.0, semilla=0, abierta=False):
    """Cajon de tablas con listones en los cantos."""
    p = []; g = 0.025; rng = azar(semilla + 60)
    if _L[0] == 2:
        p.append(caja(dx, dy, dz, (0, 0, dz / 2), color=hexlin(MADERA_CLARA) * rng.uniform(0.8, 1.05), tono=0.2, semilla=semilla))
    else:
        nt = N(3, 1, 1)
        for sy in (-1, 1):
            for i in range(nt):
                h = dz / nt
                p.append(caja(dx, g, h - 0.012, (0, sy * (dy / 2 - g / 2), (i + 0.5) * h), color=hexlin(MADERA_CLARA) * rng.uniform(0.75, 1.1), tono=0.15, semilla=semilla + i))
        for sx in (-1, 1):
            for i in range(nt):
                h = dz / nt
                p.append(caja(g, dy - 2 * g, h - 0.012, (sx * (dx / 2 - g / 2), 0, (i + 0.5) * h), color=hexlin(MADERA_CLARA) * rng.uniform(0.7, 1.0), tono=0.15, semilla=semilla + 9 + i))
        p.append(caja(dx - 0.01, dy - 0.01, g, (0, 0, g / 2 if abierta else dz - g / 2), color=hexlin(MADERA_CLARA) * 0.9, tono=0.15, semilla=semilla + 20))
        if _L[0] == 0:
            for sx in (-1, 1):
                for sy in (-1, 1):
                    p.append(caja(0.05, 0.02, dz + 0.01, (sx * (dx / 2 - 0.03), sy * (dy / 2 + 0.008), dz / 2), color=MADERA_OSC))
    o = unir(p, 'cajon')
    return mover(o, loc, (0, 0, rz))


def _saco(loc, r=0.26, alto=0.5, semilla=0, color='#8a7a5c', tumbado=False):
    o = torno([(0, 0), (r * 0.8, 0.02), (r, alto * 0.3), (r * 0.92, alto * 0.7), (r * 0.42, alto * 0.93), (r * 0.5, alto), (0, alto * 0.97)] if _L[0] < 2 else [(0, 0), (r, alto * 0.3), (r * 0.45, alto), (0, alto)], N(8, 6, 5), 'liso', color)
    if _L[0] == 0: desplazar(o, 0.035, 5.0, semilla)
    variar(o, 0.25, 6.0, semilla)
    return mover(o, loc, (1.35, 0, semilla * 1.3) if tumbado else (0, 0, semilla))


def _acabar(p, nombre, musgo=0.0, base=0.3, ang=40, luz=0.35, sombra=0.3):
    o = unir(p, nombre)
    envejecer(o, musgo=musgo, base=base)
    desgastar(o, luz, sombra)
    return suavizar(o, ang)


@objeto('barril', (430, 180, 44), ao_dist=0.9)
def barril():
    return _acabar([_barril()], 'barril')


@objeto('cajon', (330, 100, 14), ao_dist=0.9)
def cajon():
    return _acabar([_cajon()], 'cajon')



def _es_marca(o, marca):
    """Mascara de los vertices que tocan caras de esa marca."""
    me = o.data; nombres = [m_.name for m_ in me.materials]; r = np.zeros(len(me.vertices), dtype=bool)
    if 'dq_' + marca not in nombres: return r
    idx = nombres.index('dq_' + marca)
    for pol in me.polygons:
        if pol.material_index == idx:
            for v in pol.vertices: r[v] = True
    return r


def _acabar_con(p, nombre, guardar=('emisivo', 'hoja'), musgo=0.0, base=0.3, ang=42, z_musgo=0.5):
    """Como _acabar, pero el envejecido no toca las caras emisivas ni la tela (su color es exacto)."""
    o = unir(p, nombre)
    m = np.zeros(len(o.data.vertices), dtype=bool)
    for g in guardar: m |= _es_marca(o, g)
    C0 = color_de(o)
    envejecer(o, musgo=musgo, base=base, z_musgo=z_musgo); desgastar(o, 0.3, 0.3)
    C = color_de(o); C[m] = C0[m]; poner_color(o, C)
    return suavizar(o, ang)


# ═══════════════ FUENTE DE LA PLAZA (4,8 m de ancho; el juego choca con un circulo de 2,5 m) ═══════════════
AGUA = '#234850'


def _agua(r, z, lados, semilla=0, color=AGUA):
    """Lamina de agua: disco con dos anillos para que el color y la oclusion tengan donde variar. Marca «vidrio»."""
    o = torno([(r, z), (r * 0.62, z + 0.012), (r * 0.3, z + 0.02), (0, z + 0.03)] if _L[0] < 2 else [(r, z), (0, z + 0.02)], lados, 'vidrio', color)
    pintar_fn(o, lambda P, Nn, C: C * (0.8 + 0.5 * np.clip(ruido_fbm(P, 2.2, semilla) + 0.3, 0, 1))[:, None] + hexlin('#9fd6d2')[None, :] * (0.07 * np.clip(ruido_fbm(P, 4.0, semilla + 3), 0, 1))[:, None])
    return o


def _cantaro(z, alto=0.75, lados=8, color=BARRO):
    """El Cantaro Eterno, en pequeño: remata la fuente y de el mana el agua."""
    h = alto
    o = torno([(0.1, z), (0.2, z + 0.1 * h), (0.3, z + 0.38 * h), (0.27, z + 0.58 * h), (0.13, z + 0.78 * h), (0.12, z + 0.86 * h), (0.19, z + h), (0.14, z + h), (0.08, z + 0.9 * h), (0, z + 0.9 * h)] if _L[0] < 2 else [(0.1, z), (0.3, z + 0.4 * h), (0.12, z + 0.82 * h), (0.19, z + h), (0, z + 0.92 * h)], lados, 'liso', color)
    P = pos(o); banda = np.abs((P[:, 2] - z) / h - 0.47) < 0.1
    C = color_de(o); C[banda] = hexlin('#4b2a66'); poner_color(o, C)   # cenefa morada: la chicha
    return o


@objeto('fuente', (2300, 1100, 280), ao_dist=1.6)
def fuente():
    p = []
    n = N(12, 10, 8)
    # grada y pilon de sillares
    p += sillares(2.28, n, 0.5, 0.26, -0.1, 1, PIEDRA_OSC, 0, desfase=0.2)
    p += sillares(2.02, n, 0.42, 0.66, 0.1, 2, PIEDRA, 0.045)
    # albardilla (el brocal donde uno se sienta)
    b = torno([(1.76, 0.74), (2.27, 0.74), (2.3, 0.78), (2.3, 0.84), (2.25, 0.88), (1.8, 0.88), (1.76, 0.84), (1.76, 0.5)] if _L[0] < 2 else [(2.3, 0.74), (2.28, 0.88), (1.78, 0.88), (1.78, 0.5)], N(20, 12, 8), 'piedra', '#8a867c')
    variar(b, 0.3, 1.7, 5); p.append(b)
    p.append(_agua(1.8, 0.6, N(14, 10, 8), 1))
    # pilar central con basa y nudo
    c = torno([(0.62, 0.55), (0.62, 0.72), (0.5, 0.8), (0.36, 0.86), (0.3, 1.3), (0.38, 1.36), (0.38, 1.44), (0.27, 1.52), (0.24, 1.9), (0.3, 1.98)] if _L[0] < 2 else [(0.6, 0.55), (0.34, 0.86), (0.25, 1.95)], N(10, 8, 6), 'piedra', PIEDRA)
    variar(c, 0.25, 2.5, 8); p.append(c)
    # taza alta: por fuera y por dentro, con su agua
    t = torno([(0.28, 1.95), (0.6, 2.0), (1.0, 2.14), (1.12, 2.26), (1.14, 2.32), (1.06, 2.33), (0.98, 2.24), (0.5, 2.12), (0, 2.1)] if _L[0] < 2 else [(0.28, 1.95), (1.0, 2.14), (1.14, 2.32), (1.0, 2.26), (0, 2.12)], N(16, 10, 8), 'piedra', '#86827a')
    variar(t, 0.28, 2.0, 9); p.append(t)
    p.append(_agua(1.0, 2.27, N(10, 8, 6), 2))
    # peana y cantaro
    p.append(torno([(0.3, 2.1), (0.26, 2.42), (0.2, 2.5), (0.2, 2.56), (0, 2.56)] if _L[0] < 2 else [(0.3, 2.1), (0.2, 2.56), (0, 2.56)], N(8, 6, 5), 'piedra', PIEDRA_OSC))
    p.append(_cantaro(2.54, 0.78, N(10, 8, 6)))
    # cuatro caños: el agua cae de la taza al pilon
    if _L[0] < 2:
        for k in range(4):
            a = k * math.pi / 2 + math.pi / 4; d = np.array([math.cos(a), math.sin(a), 0])
            p.append(caja(0.2, 0.16, 0.1, tuple(d * 1.15 + [0, 0, 2.2]), (0, 0, a), marca='piedra', color=PIEDRA_OSC, bisel=0.02))
            m = N(7, 4, 3)
            pts = [d * 1.2 + [0, 0, 2.22], d * 1.36 + [0, 0, 2.14], d * 1.5 + [0, 0, 1.7], d * 1.56 + [0, 0, 1.1], d * 1.58 + [0, 0, 0.6]]
            ch = tubo(curva(pts, m), np.linspace(0.035, 0.06, m), N(5, 3, 3), 'chorro', 'vidrio', '#bfe6e2', punta=False)
            degradar(ch, '#8fc9c8', '#e4f6f2'); p.append(ch)
            if _L[0] == 0: p.append(torno([(0.22, 0.615), (0.12, 0.64), (0, 0.645)], 6, 'vidrio', '#d8efec', loc=tuple(d * 1.58)))   # espuma donde cae
    # verdin y musgo al pie y en lo que mira arriba; el agua conserva su color
    return _acabar_con(p, 'fuente', ('vidrio',), musgo=0.5, base=0.2, z_musgo=0.5)


# ═══════════════ POZO (brocal de 1,2 m de radio, tejadillo y torno con cubo) ═══════════════
@objeto('pozo', (1500, 560, 180), ao_dist=1.4)
def pozo():
    p = []
    n = N(10, 8, 6)
    p += sillares(1.02, n, 0.36, 0.42, -0.1, 11, PIEDRA_OSC, 0)
    p += sillares(1.0, n, 0.34, 0.4, 0.32, 12, PIEDRA, 0.04, desfase=math.pi / n)
    b = torno([(0.8, 0.7), (1.2, 0.7), (1.22, 0.76), (1.18, 0.82), (0.84, 0.82), (0.8, 0.78), (0.8, 0.2)] if _L[0] < 2 else [(1.2, 0.7), (1.2, 0.82), (0.82, 0.82), (0.82, 0.3)], N(20, 10, 6), 'piedra', '#86827a')
    variar(b, 0.3, 2.0, 4); p.append(b)
    p.append(torno([(0.82, 0.22), (0, 0.22)], N(10, 8, 6), 'liso', '#0e1a1e'))   # la boca, a oscuras
    # dos pies derechos, tejadillo a dos aguas y torno
    for sx in (-1, 1):
        p.append(caja(0.14, 0.14, 2.3, (sx * 1.02, 0, 1.25), color=MADERA_OSC, bisel=0.02, tono=0.2, semilla=sx))
        if _L[0] < 2: p.append(caja(0.1, 0.1, 0.75, (sx * 0.8, 0, 2.18), (0, sx * 0.75, 0), color=MADERA, tono=0.2))
    p.append(caja(2.5, 0.12, 0.12, (0, 0, 2.42), color=MADERA_OSC, bisel=0.02))
    for sy in (-1, 1):
        t = tablas(N(4, 1, 1), 2.7, 0.95, 0.045, (0, 0, 0), 'x', '#5a3a2a', 20 + sy, marca='teja')
        for o in t: mover(o, (0, sy * 0.4, 2.6), (sy * -0.62, 0, 0))
        p += t
    if _L[0] < 2:
        p.append(barra((-0.98, 0, 1.55), (0.98, 0, 1.55), 0.07, N(8, 5, 4), 'madera', MADERA_CLARA))
        p.append(barra((0.95, 0, 1.55), (1.3, 0, 1.55), 0.02, 4)); p.append(barra((1.3, 0, 1.55), (1.3, 0, 1.25), 0.02, 4)); p.append(barra((1.3, 0, 1.25), (1.48, 0, 1.25), 0.025, 4, 'madera', MADERA))
        p.append(barra((0.1, -0.07, 1.55), (0.1, -0.07, 1.05), 0.014, 3, 'liso', '#8a7a5c'))
        p.append(torno([(0, 0.78), (0.16, 0.78), (0.2, 1.06), (0.17, 1.06), (0.14, 0.82), (0, 0.82)], N(8, 6, 5), 'madera', MADERA_CLARA, loc=(0.1, -0.07, 0)))
        p.append(mover(aro(0.185, 0.92, 0.035, 0.008, N(8, 6, 5)), (0.1, -0.07, 0)))
    return _acabar(p, 'pozo', musgo=0.7, ang=42)


# ═══════════════ PUESTO DE MERCADO (2,4 × 2,4 × 3 m; el toldo lleva marca «hoja»: el juego le da color y lo mece) ═══════════════
def _toldo(x0, x1, y0, z0, y1, z1, nx, ny, comba=0.16, semilla=0, faldon=0.28):
    """Lona de (y0, z0) [atras, alto] a (y1, z1) [delante, bajo], combada entre apoyos, con faldon de picos delante.
    Color = multiplicador del color de instancia: listas claras y oscuras."""
    verts = []; caras = []
    for j in range(ny + 1):
        v = j / ny
        for i in range(nx + 1):
            u = i / nx
            z = z0 + (z1 - z0) * v - comba * math.sin(math.pi * v) * (0.55 + 0.45 * math.sin(math.pi * u)) - 0.05 * math.sin(math.pi * u) * v
            verts.append((x0 + (x1 - x0) * u, y0 + (y1 - y0) * v, z))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i; caras.append((a, a + 1, a + nx + 2, a + nx + 1))
    b = ny * (nx + 1)
    for i in range(nx):   # faldon: picos colgando del borde delantero
        pa = np.array(verts[b + i]); pb = np.array(verts[b + i + 1]); m = (pa + pb) / 2 + np.array([0, -0.03, -faldon])
        verts.append(tuple(m)); caras.append((b + i, len(verts) - 1, b + i + 1))
    o = malla('toldo', verts, caras, 'hoja', (1, 1, 1))
    P = pos(o); lista = np.floor((P[:, 0] - x0) / (x1 - x0) * nx * 0.999 + 0.5).astype(int) % 2
    r = ruido_fbm(P, 1.6, semilla)
    k = np.where(lista == 0, 1.0, 0.6) * (0.9 + 0.22 * r) * (1 - 0.3 * np.clip((y0 - P[:, 1]) / (y0 - y1) - 0.75, 0, 1) * 2)
    poner_color(o, np.repeat(k[:, None], 3, axis=1))
    poner_viento(o, lambda Q: np.clip((y0 - Q[:, 1]) / (y0 - y1), 0, 1) ** 2 * 0.9 + (Q[:, 2] < z1 - 0.1) * 0.1)
    dos_caras(o)
    o['dq_afilado'] = 1
    return o


def _cesta(loc, r=0.2, alto=0.16, fruto='#5b2a6e', semilla=0):
    """Cesta de mimbre con su monton (maiz morado, papas, aji...)."""
    L = N(8, 6, 5)
    c = torno([(0, 0), (r * 0.75, 0), (r, alto), (r * 0.9, alto), (0, alto * 0.8)] if _L[0] < 2 else [(0, 0), (r * 0.75, 0), (r, alto), (0, alto)], L, 'liso', '#8b7244')
    variar(c, 0.3, 30.0, semilla)
    m = torno([(r * 0.88, alto * 0.9), (r * 0.6, alto + r * 0.38), (0, alto + r * 0.55)], L, 'liso', fruto)
    if _L[0] == 0: desplazar(m, r * 0.16, 14.0, semilla)
    variar(m, 0.4, 22.0, semilla + 1)
    return [mover(c, loc), mover(m, loc)]


@objeto('puesto', (1600, 660, 170), ao_dist=1.4)
def puesto():
    p = []
    # cuatro pies derechos: los de atras, mas altos
    for sx in (-1, 1):
        p.append(caja(0.11, 0.11, 3.1, (sx * 1.08, 1.02, 1.3), (0, sx * 0.015, 0), color=MADERA_OSC, bisel=0.018, tono=0.2, semilla=sx))
        p.append(caja(0.11, 0.11, 2.55, (sx * 1.08, -1.02, 1.02), (0, sx * -0.02, 0), color=MADERA_OSC, bisel=0.018, tono=0.2, semilla=3 + sx))
        p.append(caja(0.07, 2.2, 0.09, (sx * 1.08, 0, 2.52), (0.27, 0, 0), color=MADERA, tono=0.2))    # par del toldo
        if _L[0] < 2: p.append(caja(0.06, 2.05, 0.08, (sx * 1.08, 0, 0.5), color=MADERA, tono=0.2))    # riostra baja
    p.append(caja(2.3, 0.08, 0.1, (0, 1.02, 2.8), color=MADERA, tono=0.2)); p.append(caja(2.3, 0.08, 0.1, (0, -1.02, 2.24), color=MADERA, tono=0.2))
    # mostrador de tablas con frente cerrado
    p += tablas(N(4, 1, 1), 2.34, 0.82, 0.05, (0, -0.72, 0.95), 'x', MADERA_CLARA, 4)
    p.append(caja(2.16, 0.035, 0.84, (0, -1.06, 0.5), color=MADERA, tono=0.25, semilla=8))
    if _L[0] == 0:
        for x in (-0.72, 0, 0.72): p.append(caja(0.07, 0.03, 0.86, (x, -1.085, 0.5), color=MADERA_OSC))
    # repisa del fondo y espaldar
    p.append(caja(2.1, 0.4, 0.045, (0, 0.82, 1.15), color=MADERA_CLARA, tono=0.25, semilla=2))
    p.append(caja(2.1, 0.03, 1.0, (0, 1.04, 0.62), color=MADERA, tono=0.3, semilla=6))
    # toldo
    p.append(_toldo(-1.3, 1.3, 1.16, 2.92, -1.32, 2.24, N(8, 4, 2), N(5, 3, 2), 0.17, 3))
    # genero: cestas en el mostrador, cantaros en la repisa, ristra colgada
    if _L[0] < 2:
        p += _cesta((-0.72, -0.72, 0.975), 0.24, 0.17, '#4f2863', 1)                      # maiz morado
        p += _cesta((-0.12, -0.66, 0.975), 0.2, 0.15, '#9a7a3e', 2)                       # papas
        p += _cesta((0.42, -0.74, 0.975), 0.2, 0.15, '#8f2f22', 3)                        # aji
        p.append(mover(_cantaro(0, 0.42, N(8, 6, 5), '#6a4630'), (0.62, 0.82, 1.17))); p.append(mover(_cantaro(0, 0.34, N(8, 6, 5), BARRO), (0.2, 0.84, 1.17)))
        p.append(_cajon(0.5, 0.4, 0.34, (-0.6, 0.6, 0), 0.2, 7))
    if _L[0] == 0:
        p.append(_saco((0.92, -0.2, 0), 0.2, 0.42, 3))
        p.append(caja(0.46, 0.3, 0.03, (0.88, -0.72, 0.99), (0, 0, 0.2), marca='liso', color='#6e5a8a'))   # paño
        for k in range(5):   # ristra de mazorcas colgando del travesaño
            p.append(torno([(0, 1.9), (0.04, 1.93), (0.045, 2.08), (0, 2.16)], 5, 'liso', ('#4f2863', '#b08a2e')[k % 2], loc=(-0.9 + k * 0.16, -1.0, 0)))
    return _acabar_con(p, 'puesto', ang=40)


# ═══════════════ MESA, BANCO y TABURETE de taberna ═══════════════
def _mesa(largo=2.3, ancho=1.0, alto=0.84, semilla=0):
    """Mesa de caballetes: tablero de tablones, dos pies en aspa y un travesaño."""
    p = tablas(N(4, 1, 1), largo, ancho, 0.07, (0, 0, alto - 0.035), 'x', MADERA, semilla, bisel=0.016)
    for sx in (-1, 1):
        x = sx * (largo / 2 - 0.32)
        if _L[0] < 2:
            for s in (-1, 1): p.append(caja(0.09, 0.12, alto + 0.12, (x, 0, (alto - 0.07) / 2 - 0.05), (s * 0.52, 0, 0), color=MADERA_OSC, bisel=0.014, tono=0.2, semilla=semilla + s))
            p.append(caja(0.1, ancho * 0.86, 0.08, (x, 0, alto - 0.11), color=MADERA_OSC))
        else: p.append(caja(0.1, ancho * 0.8, alto - 0.07, (x, 0, (alto - 0.07) / 2 - 0.1), color=MADERA_OSC))
    if _L[0] < 2: p.append(caja(largo - 0.5, 0.07, 0.11, (0, 0, 0.36), color=MADERA_OSC, bisel=0.012, tono=0.2))
    return p


def _banco(largo=2.2, ancho=0.36, alto=0.5, semilla=0):
    p = [caja(largo, ancho, 0.07, (0, 0, alto - 0.035), color=hexlin(MADERA) * 1.05, bisel=0.02, tono=0.25, semilla=semilla)]
    for sx in (-1, 1):
        p.append(caja(0.08, ancho * 0.9, alto + 0.2, (sx * (largo / 2 - 0.26), 0, (alto - 0.07) / 2 - 0.1), (0, sx * 0.13, 0), color=MADERA_OSC, bisel=0.014))
    if _L[0] < 2: p.append(caja(largo - 0.6, 0.05, 0.08, (0, 0, alto * 0.45), color=MADERA_OSC))
    return p


@objeto('mesa', (420, 150, 40), ao_dist=1.0)
def mesa(): return _acabar(_mesa(), 'mesa')


@objeto('banco', (260, 90, 36), ao_dist=0.8)
def banco(): return _acabar(_banco(), 'banco')


@objeto('taburete', (260, 100, 40), ao_dist=0.7)
def taburete():
    p = [torno([(0, 0.44), (0.24, 0.44), (0.26, 0.47), (0.26, 0.51), (0.23, 0.53), (0, 0.53)] if _L[0] < 2 else [(0, 0.44), (0.25, 0.44), (0.25, 0.53), (0, 0.53)], N(10, 7, 5), 'madera', MADERA)]
    for k in range(3):
        a = k * 2.094 + 0.4; d = np.array([math.cos(a), math.sin(a), 0])
        p.append(barra(tuple(d * 0.27 + [0, 0, -0.3]), tuple(d * 0.14 + [0, 0, 0.45]), 0.032, N(5, 4, 3), 'madera', MADERA_OSC))
        if _L[0] == 0:
            a2 = ((k + 1) % 3) * 2.094 + 0.4; d2 = np.array([math.cos(a2), math.sin(a2), 0])
            p.append(barra(tuple(d * 0.2 + [0, 0, 0.2]), tuple(d2 * 0.2 + [0, 0, 0.2]), 0.016, 3, 'madera', MADERA_OSC))
    return _acabar(p, 'taburete')


def _vaso(loc, color=BARRO, lleno=VIOLETA):
    v = torno([(0, 0), (0.05, 0), (0.07, 0.15), (0.058, 0.15), (0, 0.13)] if _L[0] == 0 else [(0, 0), (0.05, 0), (0.07, 0.15), (0, 0.14)], N(6, 5, 4), 'liso', color)
    P = pos(v); C = color_de(v); C[(np.hypot(P[:, 0], P[:, 1]) < 0.02) & (P[:, 2] > 0.1)] = hexlin(lleno) * 0.45; poner_color(v, C)
    return mover(v, loc)


def _olla_morada(r=0.42, z=0.0, lados=12, loc=(0, 0, 0)):
    """La olla de la chichera: barro oscuro con engobe morado, boca ancha y la chicha brillando dentro."""
    h = r * 1.75
    o = torno([(0, z), (r * 0.45, z), (r * 0.86, z + h * 0.2), (r, z + h * 0.45), (r * 0.9, z + h * 0.72), (r * 0.66, z + h * 0.88), (r * 0.78, z + h), (r * 0.7, z + h), (r * 0.58, z + h * 0.9)] if _L[0] < 2 else [(0, z), (r * 0.5, z), (r, z + h * 0.45), (r * 0.66, z + h * 0.88), (r * 0.78, z + h), (r * 0.6, z + h * 0.9)], lados, 'liso', '#6a3f5c')
    P = pos(o); t = (P[:, 2] - z) / h; C = color_de(o)
    C = C * (0.85 + 0.3 * np.clip(ruido_fbm(P, 5.0, 3), -1, 1))[:, None]
    C[(t > 0.5) & (t < 0.66)] = hexlin('#8e5bbf'); C[t > 0.86] = hexlin('#6d4634')
    C = C * (1 - 0.45 * np.clip(0.3 - t, 0, 1) / 0.3)[:, None]   # tiznada por abajo
    poner_color(o, C)
    out = [o]
    ch = torno([(r * 0.6, z + h * 0.9), (r * 0.3, z + h * 0.905), (0, z + h * 0.91)], lados, 'emisivo', '#5a2f9c')
    pintar_fn(ch, lambda Q, Nn, Cc: Cc * (0.75 + 0.6 * np.clip(ruido_fbm(Q, 9.0, 2), 0, 1))[:, None]); out.append(ch)
    if _L[0] < 2:
        for s in (-1, 1):
            a0 = -math.pi / 2 if s > 0 else math.pi / 2
            out.append(tubo(arco_pts((s * r * 0.8, 0, z + h * 0.8), r * 0.2, a0, a0 + math.pi, N(5, 3, 3), 'xz'), 0.03, N(4, 3, 3), 'asa', 'liso', '#6a3f5c', punta=False))
    return [mover(x, loc) for x in out]


def _brasas(r, z, semilla=0, n=6):
    """Leños cruzados y brasas encendidas (marca emisiva: brillan, mas de noche)."""
    rng = azar(semilla + 80); out = []; m = N(n, 4, 0)
    for k in range(m):
        a = k * math.pi * 2 / max(m, 1) + rng.uniform(-0.3, 0.3); d = np.array([math.cos(a), math.sin(a), 0])
        l = barra(tuple(d * r * 1.05 + [0, 0, z + 0.03]), tuple(-d * r * 0.25 + [0, 0, z + 0.2]), 0.055, N(5, 4, 3), 'madera', '#2a211b', tapa=True)
        pintar_fn(l, lambda P, Nn, C: C + hexlin('#b8431c')[None, :] * (np.clip(1 - np.hypot(P[:, 0], P[:, 1]) / (r * 0.6), 0, 1) * 0.5)[:, None]); out.append(l)
    b = torno([(r * 0.7, z), (r * 0.5, z + 0.1), (r * 0.2, z + 0.17), (0, z + 0.19)], N(8, 6, 5), 'emisivo', BRASA)
    if _L[0] == 0: desplazar(b, 0.04, 9.0, semilla)
    pintar_fn(b, lambda P, Nn, C: hexlin('#ff7a2a')[None, :] * (0.55 + 0.75 * np.clip(ruido_fbm(P, 11.0, semilla) + 0.35, 0, 1))[:, None] + hexlin('#ffd27a')[None, :] * (0.5 * np.clip(ruido_fbm(P, 7.0, semilla + 5), 0, 1))[:, None])
    out.append(b)
    return out


@objeto('olla_chicha', (1100, 480, 180), ao_dist=1.1)
def olla_chicha():
    """La olla morada de Mama Asiri sobre su fogon de piedras, con el cucharon."""
    p = []
    n = N(7, 6, 4)
    for k in range(n):
        a = k * 2 * math.pi / n + 0.2
        p.append(piedra_suelta(0.2, (math.cos(a) * 0.62, math.sin(a) * 0.62, 0.06), k, ('#5e5a54', '#4a4743')[k % 2], (1, 1.15, 0.8)))
    p += _brasas(0.42, 0.0, 1)
    for k in range(N(3, 3, 0)):   # tres piedras altas sostienen la olla
        a = k * 2.094 + 0.7; p.append(piedra_suelta(0.17, (math.cos(a) * 0.38, math.sin(a) * 0.38, 0.2), 20 + k, '#45423e', (0.8, 0.8, 1.5), sub=1))
    p += _olla_morada(0.5, 0.36, N(12, 9, 6))
    if _L[0] < 2:
        p.append(barra((0.18, -0.1, 1.12), (0.62, -0.5, 1.5), 0.022, 4, 'madera', MADERA_CLARA))
        p.append(mover(torno([(0, 0), (0.07, 0.02), (0.085, 0.08), (0.07, 0.08), (0, 0.04)], 6, 'madera', MADERA_CLARA), (0.15, -0.07, 1.07), (0.5, 0.3, 0)))
    o = unir(p, 'olla_chicha')
    luz = _es_marca(o, 'emisivo'); C0 = color_de(o)
    manchar(o, '#17130f', lambda P, Nn: np.clip(0.75 - np.hypot(P[:, 0], P[:, 1]), 0, 1) * (P[:, 2] < 0.5) * (Nn[:, 2] < 0.6) * 1.4, 0.75, 6.0, 2)   # hollin
    desgastar(o, 0.3, 0.3)
    C = color_de(o); C[luz] = C0[luz]; poner_color(o, C)
    return suavizar(o, 45)


@objeto('mesa_chichera', (1000, 490, 125), ao_dist=1.0)
def mesa_chichera():
    """Mesa de Mama Asiri: paño morado, la olla de servir y los vasos de barro llenos."""
    p = _mesa(2.3, 1.0, 0.84, 3)
    p.append(caja(0.9, 1.06, 0.012, (0.42, 0, 0.848), marca='liso', color='#4b2a66'))
    if _L[0] < 2:
        for sy in (-1, 1): p.append(caja(0.9, 0.012, 0.16, (0.42, sy * 0.53, 0.77), marca='liso', color='#432559'))
    p += _olla_morada(0.3, 0.845, N(10, 8, 6), (-0.62, 0, 0))
    if _L[0] < 2:
        for i in range(4): p.append(_vaso((0.2 + (i % 2) * 0.42, (-0.2 if i < 2 else 0.2), 0.855)))
        p.append(mover(_cantaro(0, 0.4, N(8, 6, 5), '#6a4630'), (-0.05, 0.28, 0.845)))
    return _acabar_con(p, 'mesa_chichera')


@objeto('mesa_panes', (900, 340, 100), ao_dist=1.0)
def mesa_panes():
    """Mesa de la Abuela Sisa: paño crudo y seis panes recien salidos."""
    p = _mesa(2.2, 1.0, 0.84, 5)
    p.append(caja(1.9, 0.8, 0.012, (0, 0, 0.848), marca='liso', color='#9a8c70'))
    for i in range(6):
        b = torno([(0.19, 0.855), (0.2, 0.9), (0.13, 0.96), (0, 0.975)] if _L[0] < 2 else [(0.19, 0.855), (0, 0.96)], N(8, 6, 4), 'liso', '#9a6a30', esc=(1, 0.66))
        pintar_fn(b, lambda P, Nn, C: C * (0.7 + 0.5 * np.clip((P[:, 2] - 0.86) / 0.1, 0, 1))[:, None])
        p.append(mover(b, (-0.65 + (i % 3) * 0.65, -0.22 if i < 3 else 0.22, 0)))
    return _acabar(p, 'mesa_panes', ang=42)


# ═══════════════ HORNO DE BARRO (cupula de 1,05 m de radio sobre poyo de piedra; la boca mira al frente) ═══════════════
@objeto('horno', (1300, 460, 160), ao_dist=1.3)
def horno():
    p = []
    n = N(9, 7, 6)
    p += sillares(0.92, n, 0.42, 0.62, -0.1, 31, PIEDRA_OSC, 0.04)
    p.append(torno([(1.12, 0.5), (1.14, 0.56), (1.1, 0.6), (0, 0.6)], N(14, 9, 6), 'piedra', PIEDRA))
    # cupula de barro, algo aplastada y desigual
    c = esfera((0, 0.08, 0.6), 1.0, N(3, 2, 1), (0.98, 1.0, 0.86), marca='liso', color=BARRO)
    deformar(c, lambda P: np.stack([P[:, 0], P[:, 1], np.maximum(P[:, 2], 0.58)], axis=1))
    if _L[0] < 2: desplazar(c, 0.05, 1.7, 5)
    pintar_fn(c, lambda P, Nn, C: C * (0.82 + 0.3 * ruido_fbm(P, 2.4, 7))[:, None])
    manchar(c, '#b98a62', lambda P, Nn: 0.45 + 0.4 * ruido_fbm(P, 1.3, 2), 0.55, 3.0, 8)                                        # barro mas claro, a parches
    manchar(c, '#1c1512', lambda P, Nn: np.clip(1.3 - np.hypot(P[:, 0], (P[:, 2] - 0.95) * 1.2) / 0.5, 0, 1) * (P[:, 1] < -0.5), 0.9, 4.0, 9)   # tizne sobre la boca
    c['dq_afilado'] = 1; p.append(c)
    # boca: arco de adobes, fondo a oscuras y brasas dentro
    m = N(7, 5, 3)
    for i in range(m):
        a = math.pi * (i + 0.5) / m
        p.append(caja(0.2, 0.26, 0.16, (math.cos(a) * 0.4, -0.93, 0.6 + math.sin(a) * 0.4 + 0.02), (0, -(a - math.pi / 2), 0), marca='liso', color=hexlin('#8a5a3c') * (0.85 + 0.25 * (i % 2)), bisel=0.02))
    boca = [(-0.33, 0.6), (-0.33, 0.78), (-0.2, 0.92), (0, 0.97), (0.2, 0.92), (0.33, 0.78), (0.33, 0.6)]
    p.append(malla('boca', [(x, -1.0, z) for x, z in boca], [tuple(range(len(boca) - 1, -1, -1))], 'liso', '#0c0907'))
    br = torno([(0.26, 0.6), (0.16, 0.68), (0, 0.7)], N(7, 5, 4), 'emisivo', BRASA, loc=(0, -1.03, 0), esc=(1, 0.5))
    pintar_fn(br, lambda P, Nn, C: hexlin('#ff7a2a')[None, :] * (0.6 + 0.7 * np.clip(ruido_fbm(P, 12.0, 3) + 0.3, 0, 1))[:, None]); p.append(br)
    # chimenea corta, la pala apoyada y leña al costado
    p.append(torno([(0.2, 1.3), (0.17, 1.72), (0.2, 1.76), (0.13, 1.76), (0.12, 1.5)] if _L[0] < 2 else [(0.2, 1.3), (0.17, 1.76), (0, 1.74)], N(8, 6, 5), 'liso', '#6f4630', loc=(0, 0.35, 0)))
    if _L[0] < 2:
        p.append(barra((0.95, -0.82, -0.05), (0.8, -0.72, 1.55), 0.025, 4, 'madera', MADERA_CLARA))
        p.append(caja(0.26, 0.03, 0.34, (0.79, -0.71, 1.7), (0.1, 0.09, 0), color=MADERA_CLARA, tono=0.2))
        for k, (dx, dz) in enumerate(((0, 0.08), (0.16, 0.08), (0.08, 0.22))[:N(3, 2, 0)]):
            p.append(barra((-1.12 + dx, -0.8, dz), (-1.1 + dx, -0.1, dz), 0.075, N(5, 4, 3), 'madera', ('#4a3a2a', '#5c4a38')[k % 2], tapa=True))
    return _acabar_con(p, 'horno', musgo=0.5, base=0.25, ang=45, z_musgo=0.35)


# ═══════════════ CARRO (2,3 m de ancho con las ruedas, 3,5 m de largo con las varas) ═══════════════
def _rueda(r=0.62, radios=8):
    """Rueda de carro (eje X), centrada en el origen."""
    L = N(14, 9, 6); g = 0.05
    llanta = torno([(r - 0.1, -g), (r, -g), (r, g), (r - 0.1, g), (r - 0.1, -g)], L, 'madera', MADERA_OSC)
    P = pos(llanta); C = color_de(llanta); C[np.hypot(P[:, 0], P[:, 1]) > r - 0.01] = hexlin(HIERRO); poner_color(llanta, C)
    p = [llanta, torno([(0, -0.11), (0.09, -0.11), (0.12, -0.05), (0.12, 0.05), (0.09, 0.13), (0.05, 0.16), (0, 0.16)] if _L[0] < 2 else [(0, -0.1), (0.11, -0.08), (0.11, 0.1), (0, 0.14)], N(8, 6, 4), 'madera', MADERA)]
    nr = N(radios, radios // 2, 0)
    for k in range(nr):
        a = k * 2 * math.pi / nr
        p.append(barra((math.cos(a) * 0.1, math.sin(a) * 0.1, 0), (math.cos(a) * (r - 0.09), math.sin(a) * (r - 0.09), 0), 0.03, N(4, 3, 3), 'madera', MADERA_CLARA))
    if _L[0] == 2: p.append(torno([(r - 0.1, 0.01), (0.1, 0.01)], L, 'madera', '#3a2f26')); p.append(torno([(0.1, -0.01), (r - 0.1, -0.01)], L, 'madera', '#3a2f26'))
    o = unir(p, 'rueda')
    return mover(o, rot=(0, math.pi / 2, 0))


def _carro(alto_lados=0.32, semilla=0):
    p = []; zb = 0.78   # altura del piso
    for sx in (-1, 1): p.append(mover(_rueda(), (sx * 0.98, 0.15, 0.6), (0, 0, 0 if sx > 0 else math.pi)))
    p.append(barra((-0.98, 0.15, 0.6), (0.98, 0.15, 0.6), 0.05, N(6, 4, 3), 'madera', MADERA_OSC))
    p += tablas(N(5, 1, 1), 2.5, 1.5, 0.05, (0, 0.1, zb), 'y', MADERA, semilla + 1)
    for sx in (-1, 1):   # largueros que se prolongan en las varas
        p.append(caja(0.09, 2.6, 0.11, (sx * 0.62, 0.1, zb - 0.08), color=MADERA_OSC, tono=0.2, semilla=sx))
        pts = [(sx * 0.62, -1.15, zb - 0.08), (sx * 0.56, -1.7, zb - 0.16), (sx * 0.5, -2.25, 0.3), (sx * 0.48, -2.42, 0.02)]
        p.append(tubo(curva(pts, N(6, 4, 3)), 0.045, N(5, 4, 3), 'vara', 'madera', MADERA_OSC, punta=False))
    for sx in (-1, 1):   # adrales
        nk = N(2, 1, 1); h = alto_lados / nk
        for k in range(nk):
            p.append(caja(0.035, 2.44, h - 0.02, (sx * 0.74, 0.1, zb + 0.03 + (k + 0.5) * h), (0, sx * 0.1, 0), color=hexlin(MADERA) * (0.9 + 0.2 * k), tono=0.25, semilla=semilla + k + sx))
        if _L[0] < 2:
            for y in (-1.0, 0.1, 1.2): p.append(caja(0.06, 0.06, alto_lados + 0.2, (sx * 0.78, y, zb + alto_lados / 2), (0, sx * 0.1, 0), color=MADERA_OSC))
    p.append(caja(1.5, 0.035, alto_lados * 0.9, (0, 1.33, zb + 0.03 + alto_lados * 0.45), color=MADERA, tono=0.25, semilla=semilla + 7))
    if _L[0] < 2: p.append(caja(0.08, 0.08, zb - 0.1, (0, 1.2, (zb - 0.1) / 2 - 0.1), (-0.12, 0, 0), color=MADERA_OSC))   # el pie que lo calza
    return p


@objeto('carro', (1800, 950, 360), ao_dist=1.4)
def carro():
    """Carro de mano cargado de sacos y un barril."""
    p = _carro(0.3, 1)
    p.append(_barril((0.25, 0.75, 0.81), alto=0.8, r=0.27, semilla=5))
    p.append(_saco((-0.32, 0.6, 0.81), 0.25, 0.48, 1)); p.append(_saco((-0.25, -0.1, 0.83), 0.24, 0.46, 2, '#7d6e52', tumbado=_L[0] < 2))
    if _L[0] < 2: p.append(_saco((0.3, -0.45, 0.81), 0.23, 0.44, 4)); p.append(_cajon(0.5, 0.42, 0.3, (0.28, 0.05, 0.81), 0.1, 2))
    return _acabar(p, 'carro', musgo=0.2)


@objeto('carro_alto', (1500, 680, 330), ao_dist=1.4)
def carro_alto():
    """Carro de adrales altos con su carga de paja."""
    p = _carro(0.62, 2)
    o = _acabar(p, 'carro_alto', musgo=0.2)
    h = masa([(0, 0.1, 1.25, 0.66, 1.1, 0.42), (0.1, -0.5, 1.45, 0.5, 0.55, 0.36), (-0.1, 0.6, 1.5, 0.52, 0.6, 0.4), (0, 0.1, 1.72, 0.42, 0.7, 0.3)], N(0.16, 0.2, 0.3), N(420, 150, 44), 0.07, 3.0, 4, marca='liso', inflado=0.3)
    pintar(h, '#8f7d48'); variar(h, 0.45, 6.0, 3, tono='#b5a060'); poner_viento(h, 0.0)
    return unir([o, h])


# ═══════════════ VALLA, CARTEL y ANTORCHA DE PARED ═══════════════
@objeto('valla', (300, 110, 40), ao_dist=0.9)
def valla():
    """Tramo de 2,4 m de valla de palos (se repite a lo largo de X)."""
    p = []
    for sx in (-1, 1):
        m = N(4, 3, 2)
        p.append(tubo(curva([(sx * 1.2, 0, -0.4), (sx * 1.2 + 0.02, 0.01, 0.5), (sx * 1.2 - 0.01, 0, 1.15)], m), np.linspace(0.085, 0.06, m), N(6, 5, 4), 'poste', 'madera', MADERA_OSC, punta=True))
    for i, z in enumerate((0.38, 0.82)):
        p.append(tubo(curva([(-1.32, 0.07, z + 0.03 * i), (-0.3, 0.085, z - 0.03), (0.5, 0.07, z + 0.02), (1.34, 0.08, z - 0.02 * i)], N(5, 3, 2)), 0.045, N(5, 4, 3), 'palo', 'madera', (MADERA, MADERA_CLARA)[i], punta=False, tapa_base=True))
    if _L[0] == 0: p.append(barra((-1.1, -0.06, 0.2), (1.1, -0.06, 1.0), 0.035, 4, 'madera', MADERA, tapa=True))
    return _acabar(p, 'valla', musgo=0.5)


@objeto('cartel', (380, 140, 44), ao_dist=0.9)
def cartel():
    """Cartel de madera colgado de un poste con brazo (sin letras: el rotulo lo pone el juego si quiere)."""
    p = [caja(0.14, 0.14, 3.0, (0, 0, 1.2), color=MADERA_OSC, bisel=0.02, tono=0.25, semilla=1),
         caja(1.15, 0.1, 0.1, (0.5, 0, 2.5), color=MADERA_OSC, bisel=0.015, tono=0.2)]
    if _L[0] < 2: p.append(caja(0.08, 0.08, 0.7, (0.26, 0, 2.22), (0, 0.78, 0), color=MADERA))
    t = tablas(N(3, 1, 1), 0.9, 0.62, 0.05, (0, 0, 0), 'x', MADERA_CLARA, 6)
    for o in t: mover(o, rot=(math.pi / 2, 0, 0)); mover(o, (0.58, 0, 1.98), (0, 0.04, 0))
    p += t
    if _L[0] < 2:
        for x in (0.26, 0.9): p.append(barra((x, 0, 2.45), (x, 0, 2.3), 0.012, 3))
        p.append(caja(0.36, 0.064, 0.36, (0.58, 0, 1.98), (0, 0.785, 0), marca='liso', color='#4b2a66'))   # rombo pintado (por las dos caras)
    return _acabar(p, 'cartel', musgo=0.3)


@objeto('antorcha_pared', (300, 120, 66), ao_dist=0.6, suelo=False)
def antorcha_pared():
    """Antorcha de pared. Origen en el muro, a la altura del anclaje; sale hacia el frente (-Y) y arde arriba."""
    p = [caja(0.14, 0.03, 0.34, (0, -0.015, 0), marca='liso', color=HIERRO, bisel=0.01)]
    p.append(tubo(curva([(0, -0.03, -0.08), (0, -0.2, -0.1), (0, -0.3, 0.02), (0, -0.32, 0.16)], N(5, 4, 3)), 0.02, N(4, 3, 3), 'brazo', 'liso', HIERRO, punta=False))
    p.append(torno([(0.035, 0.12), (0.07, 0.2), (0.075, 0.3), (0.06, 0.3), (0, 0.22)] if _L[0] < 2 else [(0.035, 0.12), (0.075, 0.3), (0, 0.26)], N(6, 5, 4), 'liso', HIERRO_CLARO, loc=(0, -0.32, 0)))
    p.append(barra((0, -0.32, -0.25), (0, -0.32, 0.3), 0.032, N(5, 4, 3), 'madera', MADERA_OSC, tapa=True))
    o = unir(p, 'antorcha'); desgastar(o, 0.35, 0.3)
    f = esfera((0, -0.32, 0.4), 0.075, N(2, 1, 1), (1, 1, 1.9), marca='emisivo', color=BRASA)
    if _L[0] == 0: desplazar(f, 0.03, 9.0, 2)
    pintar_fn(f, lambda P, Nn, C: hexlin('#ff7a2a')[None, :] * (1 - np.clip((P[:, 2] - 0.36) / 0.25, 0, 1))[:, None] + hexlin('#ffe08a')[None, :] * np.clip((P[:, 2] - 0.36) / 0.25, 0, 1)[:, None])
    return suavizar(unir([o, f]), 42)
