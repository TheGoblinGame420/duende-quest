# ═══════════════════════════════════════════════════════
# DUENDE QUEST — familia ARBOLES («medieval mistico»)
# Diseños propios, generados por guion. Cada especie: tronco con raices y corteza, ramas y copa en masas.
# Los tres niveles salen del MISMO esqueleto (misma semilla): solo cambia cuanta malla se le pone.
# Alturas parecidas a las del kit que sustituyen (la camara y las colisiones del juego cuentan con ellas).
# ═══════════════════════════════════════════════════════
import math
import numpy as np
from dq_lib import *

CORTEZA = '#4a3b2c'
MUSGO = '#34421f'
HONDO = -0.7    # el tronco nace bajo tierra: en una ladera no se le ve el pie al aire


# ── esqueleto ──
def camino(p0, direccion, largo, n, rng, subir=0.0, caos=0.15):
    """Linea de n puntos que sale de p0 en `direccion`, se tuerce al azar y tira hacia arriba (o abajo)."""
    d = np.array(direccion, dtype=float); d /= np.linalg.norm(d); p = np.array(p0, dtype=float); pts = [p.copy()]
    for i in range(n - 1):
        d = d + rng.normal(0, caos, 3) + np.array([0, 0, subir / n]); d /= np.linalg.norm(d)
        p = p + d * largo / (n - 1); pts.append(p.copy())
    return np.array(pts)


def tronco(alto, r0, lod, rng, inclinar=0.25, lobulos=5, nervio=0.28, pie=1.0, color=CORTEZA, torcer=0.6, punta=0.3, anillos=(10, 6, 4), lados=(9, 6, 5)):
    """Tronco con el pie ensanchado en contrafuertes. Devuelve (objeto, eje n×3, radios)."""
    base = camino((0, 0, HONDO), (rng.normal(0, inclinar * 0.3), rng.normal(0, inclinar * 0.3), 1), alto - HONDO, 6, rng, 0.0, inclinar * 0.35)
    n = anillos[lod]
    eje = curva(base, n); z = np.clip(eje[:, 2] / alto, 0, 1)
    radios = r0 * ((1 - (1 - punta) * z) + pie * 0.75 * np.exp(-z * 7.0))
    fase = rng.uniform(0, 6.28)
    def perfil(tt, a):
        zz = max(0.0, (tt * (alto - HONDO) + HONDO) / alto)
        return 1 + nervio * math.exp(-zz * 6.0) * math.cos(lobulos * a + fase) + 0.07 * math.cos(3 * a + fase * 2 + tt * 5)
    o = tubo(eje, radios, lados[lod], 'tronco', 'madera', color, punta=True, perfil=perfil if lod < 2 else None, giro=torcer)
    return o, eje, radios


def en_eje(eje, radios, t):
    """Punto y radio del eje a la fraccion t de su parte visible (0 = suelo, 1 = punta)."""
    z = eje[:, 2]; zt = t * z[-1]; i = int(np.clip(np.searchsorted(z, zt) - 1, 0, len(eje) - 2)); u = np.clip((zt - z[i]) / max(1e-6, z[i + 1] - z[i]), 0, 1)
    return eje[i] * (1 - u) + eje[i + 1] * u, radios[i] * (1 - u) + radios[i + 1] * u


def raices(r0, lod, rng, n=5, largo=1.6, color=CORTEZA):
    objs = []; a0 = rng.uniform(0, 6.28)
    for k in range(n):
        a = a0 + k * 6.283 / n + rng.uniform(-0.3, 0.3); L = largo * rng.uniform(0.75, 1.25)
        j1, j2 = rng.uniform(-0.3, 0.3), rng.uniform(-0.45, 0.45)
        if lod == 2 or (lod == 1 and k >= max(3, n - 2)): continue
        d = np.array([math.cos(a), math.sin(a), 0]); lado = np.cross(d, [0, 0, 1])
        pts = [d * r0 * 0.55 + [0, 0, r0 * 1.5], d * r0 * 1.25 + [0, 0, r0 * 0.55], d * (r0 * 1.2 + L * 0.55) + [0, 0, r0 * 0.12] + lado * j1 * L, d * (r0 * 1.2 + L) + [0, 0, -0.3] + lado * j2 * L]
        m = (4, 3)[lod]
        objs.append(tubo(curva(pts, m), np.linspace(r0 * 0.42, r0 * 0.07, m), (5, 4)[lod], 'raiz', 'madera', color))
    return objs


def ramas(eje, radios, lod, rng, n=5, t0=0.45, t1=0.92, largo=3.0, subir=0.5, caos=0.22, hijas=2, color=CORTEZA, grosor=0.5, abrir=1.0, tubos_hijas=1, en_bajo=0, caer=0.0):
    """Ramas principales (y sus hijas). Devuelve (objetos, puntas): las puntas son donde va el follaje.
    en_bajo: cuantas ramas se dibujan tambien en el nivel bajo (arboles sin hojas). caer: las puntas cuelgan."""
    objs = []; puntas = []; a = rng.uniform(0, 6.28)
    for k in range(n):
        t = t0 + (t1 - t0) * (k + rng.uniform(0, 0.6)) / n; p, r = en_eje(eje, radios, t)
        a += 2.4 + rng.uniform(-0.4, 0.4)
        d = np.array([math.cos(a) * abrir, math.sin(a) * abrir, 0.35 + 0.5 * t])
        L = largo * rng.uniform(0.75, 1.15) * (1.0 - 0.35 * (t - t0) / max(1e-6, t1 - t0))
        pts = camino(p, d, L, 6, rng, subir, caos); rr = r * grosor
        if caer: pts[:, 2] -= caer * (np.linspace(0, 1, 6) ** 2) * L
        puntas.append(pts[-1]); puntas.append(pts[3])
        if lod < 2:
            m = (6, 4)[lod]; q = curva(pts, m)
            objs.append(tubo(q, np.linspace(rr, rr * 0.18, m), (6, 4)[lod], 'rama', 'madera', color))
        elif k < en_bajo:
            objs.append(tubo(curva(pts, 3), np.linspace(rr, rr * 0.2, 3), 3, 'rama', 'madera', color))
        for h in range(hijas):
            i = 2 + h; lado = np.cross(pts[i + 1] - pts[i], [0, 0, 1.0]) * (1 if (h + k) % 2 else -1)
            dh = (pts[i + 1] - pts[i]) * 0.6 + lado + [0, 0, 0.25 * L / 6]
            ph = camino(pts[i], dh, L * rng.uniform(0.4, 0.6), 4, rng, subir * 0.5, caos)
            if caer: ph[:, 2] -= caer * (np.linspace(0, 1, 4) ** 2) * L * 0.5
            puntas.append(ph[-1])
            if lod == 0 and h < tubos_hijas: objs.append(tubo(ph, np.linspace(rr * 0.45, rr * 0.1, 4), 4, 'ramita', 'madera', color))
            elif lod == 1 and h < tubos_hijas and en_bajo: objs.append(tubo(curva(ph, 3), np.linspace(rr * 0.45, rr * 0.1, 3), 3, 'ramita', 'madera', color))
    return objs, np.array(puntas)


def corteza(objs, rng, color=CORTEZA, musgo=MUSGO, cuanto_musgo=0.5, claro=1.25, alto=8.0, vetas=0.3):
    """Pinta la madera: vetas verticales, mas clara arriba y con musgo en la base y en lo que mira arriba."""
    base = hexlin(color)
    for o in objs:
        s = int(rng.integers(0, 1000))
        pintar_fn(o, lambda P, N, C: base * (0.78 + (claro - 0.78) * np.clip(P[:, 2] / alto, 0, 1))[:, None])
        variar(o, vetas, 1.0, s, None, (4.0, 4.0, 0.35))
        variar(o, 0.14, 4.0, s + 1)
        if cuanto_musgo > 0:
            manchar(o, musgo, lambda P, N: np.clip(N[:, 2] * 0.9 + 0.2, 0, 1) * 0.7 + np.clip(1.0 - P[:, 2] / 1.4, 0, 1) * 0.5, cuanto_musgo, 1.4, s + 2, 0.5)
        poner_viento(o, lambda P: np.clip((np.hypot(P[:, 0], P[:, 1]) - 0.8) / 5.0, 0, 0.45) * np.clip(P[:, 2] / 3.0, 0, 1))
    return objs


def grupos(puntas, k):
    """Reparte las puntas en k grupos cercanos (los mas alejados entre si hacen de centro). Devuelve indices."""
    P = np.asarray(puntas, dtype=float); k = min(k, len(P)); cen = [int(np.argmax(P[:, 2]))]
    while len(cen) < k:
        d = np.min(((P[:, None, :] - P[cen][None, :, :]) ** 2).sum(2), axis=1); cen.append(int(np.argmax(d)))
    g = np.argmin(((P[:, None, :] - P[cen][None, :, :]) ** 2).sum(2), axis=1)
    return [np.where(g == i)[0] for i in range(k)]


def copa(puntas, lod, rng, radio=1.1, masas=7, tris=(640, 270, 90), aplastar=0.7, semilla=0, sombra=0.36, luz=1.35, tono=None, arruga=0.2):
    """Copa en masas de follaje: las puntas de las ramas se agrupan y cada grupo es una masa aparte, con la panza
    en sombra y el lomo al sol. En el nivel bajo es una sola piel."""
    P = np.asarray(puntas, dtype=float); R = radio * rng.uniform(0.8, 1.2, len(P))
    gs = grupos(P, masas) if lod < 2 else [np.arange(len(P))]
    partes = []
    for gi, g in enumerate(gs):
        k = 1.0 if lod < 2 else 1.15
        bolas = [(P[i][0], P[i][1], P[i][2] + R[i] * 0.2, R[i] * k, R[i] * k, R[i] * k * aplastar) for i in g]
        o = masa(bolas, voxel=(0.26, 0.34, 0.5)[lod], tris=max(24, tris[lod] // len(gs)), ruido_f=(arruga, arruga * 0.8, arruga * 0.5)[lod], ruido_e=1.1, semilla=semilla + gi * 7, inflado=0.55)
        z = pos(o)[:, 2]; z0, z1 = z.min(), z.max()
        pintar_fn(o, lambda P_, N, C: np.ones((len(P_), 3)) * (sombra + (luz - sombra) * np.clip(0.5 * (P_[:, 2] - z0) / (z1 - z0 + 1e-6) + 0.5 * (N[:, 2] * 0.5 + 0.5), 0, 1) ** 1.3)[:, None])
        variar(o, 0.2, 0.9, semilla + 3 + gi, tono)
        partes.append(o)
    return partes


def falda(z_top, r, alto, lob, rng, lod, caida=0.35, marca='hoja', claro=1.0, fondo=True, centro=(0, 0), giro=0.0):
    """Un piso de ramas de conifera: estrella de `lob` puntas que cuelgan, con su panza oscura."""
    cx, cy = centro; n = lob * 2; V = [(cx, cy, z_top)]; C = [0.8 * claro]; medio = lod == 0
    jr = rng.uniform(0.82, 1.18, n); jz = rng.uniform(0.6, 1.4, n); ja = rng.uniform(-0.12, 0.12, n)
    def anillo(fr, fz, tono_p, tono_v):
        for i in range(n):
            a = giro + 6.2832 * i / n + ja[i]; punta = i % 2 == 0
            rr = r * fr * (jr[i] if punta else 0.62 + 0.1 * jr[i]); zz = z_top - alto * fz - (caida * r * jz[i] * fr * fr if punta else 0)
            V.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr, zz)); C.append((tono_p if punta else tono_v) * claro)
    if medio: anillo(0.55, 0.5, 0.95, 0.7)
    anillo(1.0, 1.0, 1.3, 0.62)
    F = []
    for i in range(n): F.append((0, 1 + i, 1 + (i + 1) % n))
    if medio:
        for i in range(n): F.append((1 + i, 1 + n + i, 1 + n + (i + 1) % n, 1 + (i + 1) % n))
    ext = 1 + (n if medio else 0)
    if fondo:
        V.append((cx, cy, z_top - alto * 0.62)); C.append(0.3 * claro); b = len(V) - 1
        for i in range(n): F.append((b, ext + (i + 1) % n, ext + i))
    o = malla('falda', V, F, marca, (1, 1, 1))
    poner_color(o, np.array(C)[:, None] * np.ones(3))
    inflar(o, [(cx, cy, z_top - alto * 1.1)], 0.5)
    if marca == 'hoja': poner_viento(o, lambda P: np.clip(np.hypot(P[:, 0] - cx, P[:, 1] - cy) / max(r, 1e-3), 0, 1) * 0.9)
    o['dq_afilado'] = 1
    return o


def cinta(p_top, largo, ancho, seg, rng, fuera=(0, 0, 0), marca='hoja', claro=(0.55, 1.15)):
    """Cinta que cuelga (cortina de sauce, liquen, jiron): dos caras, acaba en punta."""
    p = np.array(p_top, dtype=float); f = np.array(fuera, dtype=float)
    lado = np.cross(f if np.linalg.norm(f) > 1e-6 else [1.0, 0, 0], [0, 0, 1.0]); lado /= np.linalg.norm(lado) + 1e-9
    V = []; F = []; W = []; C = []
    for k in range(seg + 1):
        t = k / seg; c = p + f * (math.sin(t * 2.2) * 0.5) + np.array([0, 0, -largo * t]) + rng.normal(0, 0.05, 3) * t
        w = ancho * (1 - t * 0.85) * 0.5
        if k == seg: V.append(c); W.append(1.0); C.append(claro[1])
        else: V += [c - lado * w, c + lado * w]; W += [0.3 + 0.7 * t] * 2; C += [claro[0] + (claro[1] - claro[0]) * t] * 2
    for k in range(seg - 1): a = k * 2; F.append((a, a + 1, a + 3, a + 2))
    a = (seg - 1) * 2; F.append((a, a + 1, a + 2))
    o = malla('cinta', V, F, marca, (1, 1, 1)); poner_color(o, np.array(C)[:, None] * np.ones(3)); poner_viento(o, np.array(W))
    inflar(o, [p - f * 2.0 + [0, 0, -largo * 0.5]], 0.85)
    dos_caras(o); o['dq_afilado'] = 1
    return o


def liana(a, b, comba, rng, lod, color='#3d4a22'):
    """Liana entre dos puntos, combada por su peso."""
    if lod == 2: return None
    n = (6, 4)[lod]; t = np.linspace(0, 1, n)[:, None]
    pts = np.array(a) * (1 - t) + np.array(b) * t; pts[:, 2] -= comba * np.sin(t[:, 0] * math.pi); pts += rng.normal(0, 0.06, pts.shape) * np.sin(t * math.pi)
    o = tubo(pts, 0.045, 3, 'liana', 'madera', color, punta=False)
    poner_viento(o, np.sin(t[:, 0] * math.pi).repeat(3) * 0.8)
    return o


def seta(p, r, alto, color='#3fd6b4', lod=0):
    """Seta que brilla (emisivo)."""
    if lod == 2: return []
    pie = tubo([(p[0], p[1], p[2]), (p[0], p[1], p[2] + alto)], [r * 0.3, r * 0.22], 4, 'pie', 'liso', '#c9c2ae', punta=False)
    som = primitiva('cono', 'sombrero', 'emisivo', color, r1=r, r2=r * 0.15, alto=r * 0.7, lados=(7, 5)[lod])
    mover(som, (p[0], p[1], p[2] + alto - r * 0.1))
    degradar(som, color, '#d8fff2')
    return [pie, som]


# ── especies ──
def _roble(lod, semilla, alto=4.4, r0=0.52, inclinar=0.5):
    tr, eje, rad = tronco(alto, r0, lod, azar(semilla), inclinar=inclinar, lobulos=5, nervio=0.32, pie=1.15, torcer=1.2, punta=0.5)
    rz = raices(r0, lod, azar(semilla + 1), 5, 1.7)
    rm, puntas = ramas(eje, rad, lod, azar(semilla + 2), n=5, t0=0.5, t1=0.95, largo=3.5, subir=0.8, caos=0.3, hijas=2, grosor=0.55, abrir=1.2)
    madera = corteza([tr] + rz + rm, azar(semilla + 3), cuanto_musgo=0.65, alto=alto + 2)
    cima = eje[-1] + [0, 0, 1.2]
    hj = copa(np.vstack([puntas, [cima]]), lod, azar(semilla + 4), radio=1.2, masas=8, semilla=semilla, tono=(1.5, 1.35, 0.7))
    return unir(madera + hj)


def _abeto(lod, semilla, alto=10.0, r0=0.36, pisos=7, nieve=False, ancho=2.3):
    rng = azar(semilla + 5)
    tr, eje, rad = tronco(alto * 0.9, r0, lod, azar(semilla), inclinar=0.12, lobulos=4, nervio=0.2, pie=0.9, torcer=0.3, punta=0.12, anillos=(8, 5, 3), lados=(8, 5, 4))
    rz = raices(r0, lod, azar(semilla + 1), 4, 1.1)
    madera = [tr] + rz
    # Tocones de ramas secas en el fuste, bajo la copa.
    r2 = azar(semilla + 2)
    for k in range(3):
        t = 0.1 + 0.05 * k + r2.uniform(0, 0.03); p, r = en_eje(eje, rad, t); a = r2.uniform(0, 6.28)
        q = camino(p, (math.cos(a), math.sin(a), 0.15), r2.uniform(0.5, 0.9), 3, r2, -0.2, 0.2)
        if lod == 0: madera.append(tubo(q, [r * 0.3, r * 0.2, r * 0.08], 4, 'seca', 'madera'))
    corteza(madera, azar(semilla + 3), color='#3f3226', cuanto_musgo=0.45, alto=alto)
    z0 = alto * 0.2; partes = []
    np_ = (pisos, max(4, pisos - 2), 4)[lod]; lob = (8, 6, 6)[lod]
    for k in range(np_):
        u = k / (np_ - 1); zt = z0 + (alto - z0) * (0.22 + 0.78 * u) + (0.25 if k == np_ - 1 else 0)
        c, _ = en_eje(eje, rad, min(1.0, zt / (alto * 0.9)))
        r = ancho * (1 - u * 0.86) * rng.uniform(0.9, 1.1) * (1.12 if lod == 2 else 1.0); h = (alto - z0) / np_ * (1.45 if lod < 2 else 1.7)
        g = rng.uniform(0, 6.28)
        partes.append(falda(zt, r, h, lob, rng, lod, caida=0.3, claro=0.82 + 0.3 * u, fondo=lod < 2 or k == 0, centro=(c[0], c[1]), giro=g))
        if nieve:
            s = falda(zt + 0.07, r * 0.8, h * 0.72, lob, azar(semilla + 40 + k), lod, caida=0.22, marca='liso', claro=1.0, fondo=False, centro=(c[0], c[1]), giro=g)
            pintar_fn(s, lambda P, N, C: hexlin('#eef2f8') * (0.72 + 0.28 * np.clip(C[:, :1] / 1.2, 0, 1)) * np.array([0.93, 0.97, 1.0]))
            partes.append(s)
    for p_ in partes: variar(p_, 0.14, 1.2, semilla + 8)
    return unir(madera + partes)


def _abedul(lod, semilla, alto=6.4, r0=0.22):
    tr, eje, rad = tronco(alto, r0, lod, azar(semilla), inclinar=0.4, lobulos=3, nervio=0.12, pie=0.7, torcer=0.2, punta=0.3, anillos=(13, 7, 4), lados=(7, 5, 4))
    rm, puntas = ramas(eje, rad, lod, azar(semilla + 2), n=7, t0=0.36, t1=0.95, largo=2.1, subir=1.0, caos=0.2, hijas=1, grosor=0.45, abrir=1.0, tubos_hijas=0)
    blanco = hexlin('#d9d5c6'); negro = hexlin('#26221f')
    for o in [tr] + rm:
        P = pos(o); m = np.clip((ruido(P * np.array([0.5, 0.5, 4.2]), 1.0, semilla) - 0.12) * 7, 0, 1) + np.clip(1 - P[:, 2] / 0.9, 0, 1) * 0.8
        m = np.clip(m, 0, 1)[:, None]; poner_color(o, blanco * (1 - m) + negro * m)
        variar(o, 0.1, 3.0, semilla + 1)
        poner_viento(o, lambda P: np.clip(P[:, 2] / alto - 0.3, 0, 0.5))
    cima = eje[-1] + [0, 0, 0.7]
    hj = copa(np.vstack([puntas, [cima]]), lod, azar(semilla + 4), radio=0.82, masas=8, tris=(600, 250, 80), aplastar=0.95, semilla=semilla, luz=1.45, sombra=0.45, tono=(1.6, 1.5, 0.6), arruga=0.16)
    return unir([tr] + rm + hj)


def _muerto(lod, semilla, alto=5.4, r0=0.42):
    col = '#3b353d'
    tr, eje, rad = tronco(alto, r0, lod, azar(semilla), inclinar=0.9, lobulos=4, nervio=0.4, pie=1.2, torcer=2.6, punta=0.3, color=col)
    rz = raices(r0, lod, azar(semilla + 1), 5, 1.5, col)
    rm, puntas = ramas(eje, rad, lod, azar(semilla + 2), n=5, t0=0.42, t1=0.97, largo=3.3, subir=1.5, caos=0.45, hijas=2, grosor=0.62, abrir=1.25, tubos_hijas=2, en_bajo=4, color=col)
    madera = corteza([tr] + rz + rm, azar(semilla + 3), color=col, musgo='#4a4a52', cuanto_musgo=0.35, claro=1.5, alto=alto + 2, vetas=0.4)
    # Jirones de liquen colgando de las ramas (toman el color de la zona).
    rng = azar(semilla + 6); jir = []
    for i in rng.choice(len(puntas), 7, replace=False)[:(7, 3, 0)[lod]]:
        p = puntas[i]; jir.append(cinta(p, rng.uniform(0.7, 1.4), 0.3, (3, 2, 2)[lod], rng, (rng.normal(0, 0.1), rng.normal(0, 0.1), 0), claro=(0.9, 1.5)))
    return unir(madera + jir)


def _sauce(lod, semilla, alto=3.6, r0=0.5):
    tr, eje, rad = tronco(alto, r0, lod, azar(semilla), inclinar=0.7, lobulos=5, nervio=0.3, pie=1.2, torcer=1.0, punta=0.55)
    rz = raices(r0, lod, azar(semilla + 1), 5, 1.6)
    rm, puntas = ramas(eje, rad, lod, azar(semilla + 2), n=6, t0=0.55, t1=0.97, largo=3.4, subir=1.0, caos=0.25, hijas=1, grosor=0.5, abrir=1.2, caer=0.35)
    madera = corteza([tr] + rz + rm, azar(semilla + 3), cuanto_musgo=0.8, alto=alto + 2)
    cima = eje[-1] + [0, 0, 1.4]
    hj = copa(np.vstack([puntas, [cima]]), lod, azar(semilla + 4), radio=1.15, masas=7, tris=(380, 160, 70), aplastar=0.62, semilla=semilla, tono=(1.4, 1.45, 0.75))
    rng = azar(semilla + 6); cor = []; c0 = np.array([eje[-1][0], eje[-1][1], 0])
    for k in range((24, 9, 0)[lod]):
        p = puntas[k % len(puntas)] + rng.normal(0, 0.55, 3) * [1, 1, 0.3]; f = (p - c0) * [1, 1, 0]; f /= np.linalg.norm(f) + 1e-6
        L = min(p[2] - 0.5, rng.uniform(2.2, 3.8))
        cor.append(cinta(p + [0, 0, 0.1], L, 0.36, (3, 2)[lod], rng, f * 0.35, claro=(0.45, 1.2)))
    if lod == 2:   # sin cortinas: una falda de follaje que baja
        ext = [(p[0] * 1.05, p[1] * 1.05, p[2] - 1.3, 0.75, 0.75, 1.5) for p in puntas[::3]]
        cor.append(masa(ext, voxel=0.5, tris=44, ruido_f=0.08, semilla=semilla)); pintar(cor[-1], (0.7, 0.7, 0.7))
    return unir(madera + hj + cor)


def _selva(lod, semilla, alto=6.4, r0=0.46):
    tr, eje, rad = tronco(alto, r0, lod, azar(semilla), inclinar=0.3, lobulos=4, nervio=0.62, pie=1.9, torcer=0.5, punta=0.6)
    rz = raices(r0 * 1.2, lod, azar(semilla + 1), 4, 1.9)
    rm, puntas = ramas(eje, rad, lod, azar(semilla + 2), n=5, t0=0.74, t1=0.98, largo=3.6, subir=0.25, caos=0.22, hijas=2, grosor=0.5, abrir=1.5)
    madera = corteza([tr] + rz + rm, azar(semilla + 3), color='#4d4033', musgo='#2f4a1c', cuanto_musgo=0.9, alto=alto + 2)
    cima = eje[-1] + [0, 0, 0.9]
    hj = copa(np.vstack([puntas, [cima]]), lod, azar(semilla + 4), radio=1.45, masas=7, tris=(560, 250, 90), aplastar=0.5, semilla=semilla, tono=(1.2, 1.5, 0.8), sombra=0.3)
    rng = azar(semilla + 6); li = []
    for k in range(4):
        a = puntas[int(rng.integers(0, len(puntas)))] + [0, 0, -0.3]
        if k % 2 == 0: b = puntas[int(rng.integers(0, len(puntas)))] + [0, 0, -0.3]; comba = rng.uniform(1.2, 2.2)
        else: b = np.array([a[0] * 0.5 + rng.normal(0, 0.4), a[1] * 0.5 + rng.normal(0, 0.4), rng.uniform(0.2, 1.6)]); comba = 0.3
        if k >= (4, 2, 0)[lod]: continue
        li.append(liana(a, b, comba, rng, lod))
        if lod == 0:
            for j in range(2): li.append(cinta(a * (0.35 + 0.3 * j) + b * (0.65 - 0.3 * j) + [0, 0, -comba * 0.8], rng.uniform(0.5, 0.9), 0.32, 2, rng, claro=(0.6, 1.2)))
    return unir(madera + hj + li)


def _arbusto(lod, semilla, ancho=2.6):
    rng = azar(semilla); pts = []
    for k in range(10):
        a = k * 2.4 + rng.uniform(-0.4, 0.4); d = rng.uniform(0.35, 1.05) if k else 0.0
        r = rng.uniform(0.4, 0.62) * (1.2 if k == 0 else 1.0)
        pts.append((math.cos(a) * d, math.sin(a) * d, r * 0.7 + rng.uniform(0, 0.45) * (1.1 - d) + (0.4 if k == 0 else 0)))
    hj = copa(np.array(pts), lod, azar(semilla + 4), radio=0.52, masas=7, tris=(520, 190, 56), aplastar=0.8, semilla=semilla, tono=(1.4, 1.4, 0.7), sombra=0.3, luz=1.25, arruga=0.2)
    palos = []
    for k in range(4):
        a = rng.uniform(0, 6.28); q = camino((math.cos(a) * 0.15, math.sin(a) * 0.15, HONDO * 0.4), (math.cos(a) * 0.8, math.sin(a) * 0.8, 1), rng.uniform(1.9, 2.5), 4, rng, 0.2, 0.25)
        if k < (4, 2, 0)[lod]: palos.append(tubo(q, np.linspace(0.07, 0.015, 4), 3, 'palo', 'madera', '#4a3b2c'))
    corteza(palos, azar(semilla + 3), cuanto_musgo=0.2, alto=2)
    o = unir(hj + palos)
    P = pos(o); s = ancho / max(np.ptp(P[:, 0]), np.ptp(P[:, 1])); mover(o, esc=s)
    return o


def _tocon(lod, semilla, r0=0.5, alto=0.95):
    rng = azar(semilla); lados = (10, 7, 5)[lod]; fase = rng.uniform(0, 6.28)
    zs = [HONDO, 0.0, 0.25, 0.6, alto]; V = []; F = []
    def R(z, a): return r0 * (1 + 0.9 * math.exp(-max(z, 0) * 5) * (0.75 + 0.3 * math.cos(5 * a + fase)) + 0.06 * math.cos(3 * a + fase))
    astilla = int(azar(semilla + 9).integers(0, lados)); rz_ = azar(semilla + 8)
    for i, z in enumerate(zs):
        for k in range(lados):
            a = 6.2832 * k / lados; r = R(z, a); zz = z
            if i == len(zs) - 1: zz += rz_.uniform(-0.1, 0.12) + (0.5 if k == astilla else 0.22 if (k - astilla) % lados in (1, lados - 1) else 0)
            V.append((math.cos(a) * r, math.sin(a) * r, zz))
    for i in range(len(zs) - 1):
        for k in range(lados): a = i * lados + k; b = i * lados + (k + 1) % lados; F.append((a, b, b + lados, a + lados))
    cuerpo = malla('tocon', V, F, 'madera', CORTEZA); cuerpo['dq_afilado'] = 1
    # Corte de arriba: anillos claro / oscuro / claro hasta el centro (los años del arbol).
    top = (len(zs) - 1) * lados; V2 = [V[top + k] for k in range(lados)]; F2 = []; C2 = [hexlin('#3d3024')] * lados
    aros = ((0.8, '#8f7a58'), (0.45, '#6e5a3e'), (0.2, '#9a8562')) if lod == 0 else ((0.5, '#85704f'),)
    for fr, c in aros:
        for k in range(lados):
            x, y, z = V[top + k]; V2.append((x * fr, y * fr, alto - 0.06 + (z - alto) * fr * 0.3)); C2.append(hexlin(c))
    V2.append((0, 0, alto - 0.07)); C2.append(hexlin('#5a4832'))
    na = len(aros)
    for j in range(na):
        for k in range(lados): a = j * lados + k; b = j * lados + (k + 1) % lados; F2.append((a, b, b + lados, a + lados))
    for k in range(lados): F2.append((na * lados + k, na * lados + (k + 1) % lados, len(V2) - 1))
    corte = malla('corte', V2, F2, 'madera', '#8f7a58'); poner_color(corte, np.array(C2)); suavizar(corte, 30)
    rz = raices(r0 * 1.15, lod, azar(semilla + 1), 5, 1.2)
    corteza([cuerpo] + rz, azar(semilla + 3), cuanto_musgo=0.55, alto=2.2, claro=1.5)
    manchar(corte, MUSGO, lambda P, N: np.clip(np.hypot(P[:, 0], P[:, 1]) / r0 - 0.55, 0, 1) * 1.2, 0.8, 3.0, semilla)
    st = []
    for k in range(3):
        a = fase + k * 1.1 + 0.4; d = r0 * (1.5 + 0.25 * k)
        st += seta((math.cos(a) * d, math.sin(a) * d, -0.03), 0.2 + 0.06 * (k % 2), 0.28 + 0.12 * k, lod=lod)
    return unir([cuerpo, corte] + rz + st)


def _tronco_caido(lod, semilla, largo=2.5, r0=0.3):
    rng = azar(semilla); n = (6, 4, 3)[lod]; lados = (9, 6, 5)[lod]
    eje = np.array([[-largo / 2 + largo * i / (n - 1), rng.normal(0, 0.05), r0 * 0.82 + rng.normal(0, 0.03)] for i in range(n)])
    rad = r0 * (1 - 0.25 * np.linspace(0, 1, n)) * rng.uniform(0.93, 1.07, n)
    o = tubo(eje, rad, lados, 'caido', 'madera', CORTEZA, punta=False, perfil=lambda t, a: 1 + 0.08 * math.cos(4 * a + t * 3))
    tapas = []
    for i in (0, n - 1):
        c = primitiva('cilindro', 'tapa', 'madera', '#8f7a58', radio=rad[i] * 0.97, alto=0.04, lados=lados)
        mover(c, (0, 0, -0.02)); mover(c, rot=(0, math.pi / 2, 0)); mover(c, tuple(eje[i]))
        e_ = eje[i]; r_ = rad[i]
        pintar_fn(c, lambda P, N, C: np.where((np.hypot(P[:, 1] - e_[1], P[:, 2] - e_[2]) < r_ * 0.5)[:, None], hexlin('#6e5a3e'), hexlin('#8f7a58'))); suavizar(c, 30); tapas.append(c)
    partes = [o]
    q = camino(eje[n // 2], (0.3, 0.6, 0.8), 0.8, 3, rng, 0, 0.1)
    if lod < 2: partes.append(tubo(q, [r0 * 0.3, r0 * 0.2, r0 * 0.08], (5, 4)[lod], 'rama', 'madera'))
    corteza(partes, azar(semilla + 3), cuanto_musgo=0.6, alto=1.2, claro=1.5)
    st = []; r3 = azar(semilla + 4)
    for k in range(3): st += seta((-0.5 + 0.45 * k + r3.uniform(-0.1, 0.1), r0 * 1.15, -0.03), 0.18 + 0.05 * (k % 2), 0.24 + 0.12 * (k % 2), '#e8a23c', lod)
    return unir(partes + tapas + st)


def _seco(lod, semilla, alto=1.7, r0=0.4):
    """Huarango seco del desierto: bajo, ancho y retorcido, con matas ralas."""
    col = '#5c4a38'
    tr, eje, rad = tronco(alto, r0, lod, azar(semilla), inclinar=1.3, lobulos=4, nervio=0.35, pie=1.1, torcer=2.2, punta=0.6, color=col, anillos=(7, 5, 3))
    rz = raices(r0, lod, azar(semilla + 1), 4, 1.3, col)
    rm, puntas = ramas(eje, rad, lod, azar(semilla + 2), n=5, t0=0.6, t1=0.98, largo=2.6, subir=0.5, caos=0.42, hijas=2, grosor=0.62, abrir=1.6, tubos_hijas=2, en_bajo=3, color=col)
    madera = corteza([tr] + rz + rm, azar(semilla + 3), color=col, musgo='#7a6a4a', cuanto_musgo=0.3, claro=1.5, alto=alto + 2, vetas=0.4)
    hj = copa(puntas[::2], lod, azar(semilla + 4), radio=0.62, masas=5, tris=(300, 130, 40), aplastar=0.4, semilla=semilla, tono=(1.5, 1.3, 0.7), sombra=0.45, arruga=0.12)
    return unir(madera + hj)


def _cactus(lod, semilla, alto=3.4):
    """Cactus de columnas con costillas (toma el verde de la zona)."""
    rng = azar(semilla); lados = (12, 8, 5)[lod]; cost = 6
    def col(pts, r, n):
        q = curva(pts, n); rr = r * (1 - 0.25 * np.linspace(0, 1, n) ** 3)
        o = tubo(q, rr, lados, 'cactus', 'hoja', (1, 1, 1), perfil=(lambda t, a: 1 + 0.16 * math.cos(cost * a)) if lod < 2 else None)
        P = pos(o); ax = q[np.argmin(((P[:, None, :] - q[None, :, :]) ** 2).sum(2), axis=1)]; d = np.linalg.norm(P - ax, axis=1) / r
        poner_color(o, np.ones((len(P), 3)) * (0.5 + 0.75 * np.clip((d - 0.8) / 0.35, 0, 1))[:, None] * (0.8 + 0.3 * np.clip(P[:, 2] / alto, 0, 1))[:, None])
        poner_viento(o, 0.0); return o
    partes = [col([(0, 0, HONDO), (0.03, 0, alto * 0.5), (0, 0.04, alto)], 0.34, (7, 5, 3)[lod])]
    for k in range(2 + (semilla % 2)):
        a = rng.uniform(0, 6.28) + k * 2.3; z = alto * rng.uniform(0.3, 0.55); L = rng.uniform(0.5, 0.75); h = alto * rng.uniform(0.3, 0.42)
        d = np.array([math.cos(a), math.sin(a), 0])
        partes.append(col([d * 0.2 + [0, 0, z], d * L + [0, 0, z + 0.05], d * (L + 0.08) + [0, 0, z + h * 0.5], d * (L + 0.05) + [0, 0, z + h]], 0.2, (6, 4, 3)[lod]))
    if lod < 2:
        for p_ in partes[:2]:
            P = pos(p_); top = P[np.argmax(P[:, 2])]
            f = primitiva('cono', 'flor', 'liso', '#e56aa0', r1=0.0, r2=0.11, alto=0.16, lados=5); mover(f, tuple(top + [0, 0, -0.02])); degradar(f, '#f2c23a', '#e56aa0'); partes.append(f)
    return unir(partes)


@modelo('roble_a', sustituye={'flora': 'redondo', 'zonas': ['pueblo', 'amanecer']})
def roble_a(lod): return _roble(lod, 11)

@modelo('roble_b', sustituye={'flora': 'redondo', 'zonas': ['pueblo', 'amanecer'], 'lejos': 'roble_a'})
def roble_b(lod): return _roble(lod, 23, alto=3.8, r0=0.58, inclinar=0.8)

@modelo('abedul_a', sustituye={'flora': 'redondo', 'zonas': ['pueblo', 'amanecer']})
def abedul_a(lod): return _abedul(lod, 5)

@modelo('abeto_a', sustituye={'flora': 'pino', 'zonas': ['noche', 'castillo']})
def abeto_a(lod): return _abeto(lod, 3)

@modelo('abeto_b', sustituye={'flora': 'pino', 'zonas': ['noche', 'castillo'], 'lejos': 'abeto_a'})
def abeto_b(lod): return _abeto(lod, 17, alto=8.4, r0=0.32, pisos=6, ancho=2.5)

@modelo('nevado_a', sustituye={'flora': 'nieve', 'zonas': ['cumbres']})
def nevado_a(lod): return _abeto(lod, 29, alto=8.2, r0=0.34, pisos=6, nieve=True, ancho=2.2)

@modelo('nevado_b', sustituye={'flora': 'nieve', 'zonas': ['cumbres'], 'lejos': 'nevado_a'})
def nevado_b(lod): return _abeto(lod, 31, alto=6.8, r0=0.3, pisos=5, nieve=True, ancho=2.4)

@modelo('muerto_a', sustituye={'flora': 'muerto'})
def muerto_a(lod): return _muerto(lod, 7)

@modelo('muerto_b', sustituye={'flora': 'muerto', 'lejos': 'muerto_a'})
def muerto_b(lod): return _muerto(lod, 41, alto=4.6, r0=0.46)

@modelo('sauce_a', sustituye={'flora': 'redondo', 'orilla': True})
def sauce_a(lod): return _sauce(lod, 13)

@modelo('selva_a', sustituye={'flora': 'redondo', 'zonas': ['selva']})
def selva_a(lod): return _selva(lod, 19)

@modelo('selva_b', sustituye={'flora': 'redondo', 'zonas': ['selva'], 'lejos': 'selva_a'})
def selva_b(lod): return _selva(lod, 37, alto=5.4, r0=0.5)

@modelo('arbusto_a', sustituye={'flora': 'arbusto'}, tris=(700, 250, 70))
def arbusto_a(lod): return _arbusto(lod, 2)

@modelo('arbusto_b', sustituye={'flora': 'arbusto', 'lejos': 'arbusto_a'}, tris=(700, 250, 70))
def arbusto_b(lod): return _arbusto(lod, 9, ancho=2.2)

@modelo('tocon_a', sustituye={'flora': 'tocon'}, tris=(600, 250, 70))
def tocon_a(lod): return _tocon(lod, 4)

@modelo('tocon_b', sustituye={'flora': 'tocon'}, tris=(600, 250, 70))
def tocon_b(lod): return _tronco_caido(lod, 6)

@modelo('seco_a', sustituye={'flora': 'cactus'})
def seco_a(lod): return _seco(lod, 15)

@modelo('cactus_a', sustituye={'flora': 'cactus'}, tris=(700, 250, 80))
def cactus_a(lod): return _cactus(lod, 8)
