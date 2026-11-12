# ═══════════════════════════════════════════════════════
# DUENDE QUEST — familia ARBOLES («medieval mistico»)
# Diseños propios, generados por guion. Cada especie: tronco con raices y corteza, ramas y copa en masas.
# Los tres niveles salen del MISMO esqueleto (misma semilla): solo cambia cuanta malla se le pone.
# ═══════════════════════════════════════════════════════
import math
import numpy as np
from dq_lib import *

CORTEZA = '#4a3b2c'
MUSGO = '#3a4a20'


# ── esqueleto ──
def camino(p0, direccion, largo, n, rng, subir=0.0, caos=0.15):
    """Linea de n puntos que sale de p0 en `direccion`, se tuerce al azar y tira hacia arriba (o abajo)."""
    d = np.array(direccion, dtype=float); d /= np.linalg.norm(d); p = np.array(p0, dtype=float); pts = [p.copy()]
    for i in range(n - 1):
        d = d + rng.normal(0, caos, 3) + np.array([0, 0, subir / n]); d /= np.linalg.norm(d)
        p = p + d * largo / (n - 1); pts.append(p.copy())
    return np.array(pts)


def tronco(alto, r0, lod, rng, inclinar=0.25, lobulos=5, nervio=0.28, pie=1.0, color=CORTEZA, torcer=0.6, punta=0.3):
    """Tronco con el pie ensanchado en contrafuertes. Devuelve (objeto, eje n×3, radios)."""
    base = camino((0, 0, -0.25), (rng.normal(0, inclinar * 0.3), rng.normal(0, inclinar * 0.3), 1), alto + 0.25, 6, rng, 0.0, inclinar * 0.35)
    n = (10, 6, 4)[lod]; lados = (9, 6, 5)[lod]
    eje = curva(base, n); t = np.linspace(0, 1, n)
    radios = r0 * ((1 - (1 - punta) * t) + pie * 0.75 * np.exp(-t * 7.0))
    fase = rng.uniform(0, 6.28)
    perfil = (lambda tt, a: 1 + nervio * math.exp(-tt * 6.0) * math.cos(lobulos * a + fase) + 0.07 * math.cos(3 * a + fase * 2 + tt * 5)) if lod < 2 else None
    o = tubo(eje, radios, lados, 'tronco', 'madera', color, punta=True, perfil=perfil, giro=torcer)
    return o, eje, radios


def en_eje(eje, radios, t):
    """Punto y radio del eje a la fraccion t."""
    f = t * (len(eje) - 1); i = min(int(f), len(eje) - 2); u = f - i
    return eje[i] * (1 - u) + eje[i + 1] * u, radios[i] * (1 - u) + radios[i + 1] * u


def raices(r0, lod, rng, n=5, largo=1.6, color=CORTEZA):
    if lod == 2: return []
    objs = []; n = n if lod == 0 else max(3, n - 2)
    a0 = rng.uniform(0, 6.28)
    for k in range(n):
        a = a0 + k * 6.283 / n + rng.uniform(-0.3, 0.3); L = largo * rng.uniform(0.75, 1.25)
        d = np.array([math.cos(a), math.sin(a), 0])
        pts = [d * r0 * 0.55 + [0, 0, r0 * 1.5], d * r0 * 1.25 + [0, 0, r0 * 0.55], d * (r0 * 1.2 + L * 0.55) + [0, 0, r0 * 0.12], d * (r0 * 1.2 + L) + [0, 0, -0.22]]
        pts[2] = pts[2] + np.cross(d, [0, 0, 1]) * rng.uniform(-0.3, 0.3) * L
        pts[3] = pts[3] + np.cross(d, [0, 0, 1]) * rng.uniform(-0.45, 0.45) * L
        m = (4, 3)[lod]
        objs.append(tubo(curva(pts, m), np.linspace(r0 * 0.42, r0 * 0.07, m), (5, 4)[lod], 'raiz', 'madera', color))
    return objs


def ramas(eje, radios, lod, rng, n=5, t0=0.45, t1=0.92, largo=3.0, subir=0.5, caos=0.22, hijas=2, color=CORTEZA, grosor=0.5, abrir=1.0):
    """Ramas principales (y sus hijas). Devuelve (objetos, puntas): las puntas son donde va el follaje."""
    objs = []; puntas = []; a = rng.uniform(0, 6.28)
    for k in range(n):
        t = t0 + (t1 - t0) * (k + rng.uniform(0, 0.6)) / n; p, r = en_eje(eje, radios, t)
        a += 2.4 + rng.uniform(-0.4, 0.4)
        d = np.array([math.cos(a) * abrir, math.sin(a) * abrir, 0.35 + 0.5 * t])
        L = largo * rng.uniform(0.75, 1.15) * (1.0 - 0.35 * (t - t0) / max(1e-6, t1 - t0))
        pts = camino(p, d, L, 6, rng, subir, caos); rr = r * grosor
        puntas.append(pts[-1]); puntas.append(pts[3])
        if lod < 2:
            m = (6, 4)[lod]; q = curva(pts, m)
            objs.append(tubo(q, np.linspace(rr, rr * 0.18, m), (6, 4)[lod], 'rama', 'madera', color))
        for h in range(hijas):
            i = 2 + h; lado = np.cross(pts[i + 1] - pts[i], [0, 0, 1.0]) * (1 if (h + k) % 2 else -1)
            dh = (pts[i + 1] - pts[i]) * 0.6 + lado + [0, 0, 0.25 * L / 6]
            ph = camino(pts[i], dh, L * rng.uniform(0.4, 0.6), 4, rng, subir * 0.5, caos)
            puntas.append(ph[-1])
            if lod == 0 and h == 0: objs.append(tubo(ph, np.linspace(rr * 0.45, rr * 0.1, 4), 4, 'ramita', 'madera', color))
    return objs, np.array(puntas)


def corteza(objs, rng, color=CORTEZA, musgo=MUSGO, cuanto_musgo=0.5, claro=1.25, alto=8.0):
    """Pinta la madera: vetas verticales, mas clara arriba y con musgo en la base y en lo que mira arriba."""
    base = hexlin(color)
    for o in objs:
        s = int(rng.integers(0, 1000))
        pintar_fn(o, lambda P, N, C: base * (0.8 + (claro - 0.8) * np.clip(P[:, 2] / alto, 0, 1))[:, None])
        variar(o, 0.3, 1.0, s, None, (4.0, 4.0, 0.35))
        variar(o, 0.14, 4.0, s + 1)
        if cuanto_musgo > 0:
            manchar(o, musgo, lambda P, N: np.clip(N[:, 2] * 0.9 + 0.25, 0, 1) * 0.75 + np.clip(1.0 - P[:, 2] / 1.6, 0, 1) * 0.55, cuanto_musgo, 1.4, s + 2, 0.5)
        poner_viento(o, lambda P: np.clip((np.hypot(P[:, 0], P[:, 1]) - 0.8) / 5.0, 0, 0.45) * np.clip(P[:, 2] / 3.0, 0, 1))
    return objs


def grupos(puntas, k, rng):
    """Reparte las puntas en k grupos cercanos (los mas alejados entre si hacen de centro)."""
    P = np.asarray(puntas, dtype=float); k = min(k, len(P)); cen = [int(np.argmax(P[:, 2]))]
    while len(cen) < k:
        d = np.min(((P[:, None, :] - P[cen][None, :, :]) ** 2).sum(2), axis=1); cen.append(int(np.argmax(d)))
    g = np.argmin(((P[:, None, :] - P[cen][None, :, :]) ** 2).sum(2), axis=1)
    return [P[g == i] for i in range(k)]


def copa(puntas, lod, rng, radio=1.1, masas=7, tris=(640, 270, 90), aplastar=0.7, semilla=0, sombra=0.42, luz=1.3, tono=None, extra=(), arruga=0.2):
    """Copa en masas de follaje: las puntas de las ramas se agrupan y cada grupo es una masa aparte, con la panza
    en sombra y el lomo al sol. En el nivel bajo es una sola piel."""
    gs = grupos(puntas, masas, rng) if lod < 2 else [np.asarray(puntas)]
    partes = []; todas = []
    for gi, g in enumerate(gs):
        bolas = []
        for p in g:
            r = radio * rng.uniform(0.8, 1.2) * (1.0 if lod < 2 else 1.15)
            bolas.append((p[0], p[1], p[2] + r * 0.2, r, r, r * aplastar))
        if lod == 2: bolas += list(extra)
        todas += bolas
        o = masa(bolas, voxel=(0.26, 0.34, 0.5)[lod], tris=max(24, tris[lod] // len(gs)), ruido_f=(arruga, arruga * 0.8, arruga * 0.5)[lod], ruido_e=1.1, semilla=semilla + gi * 7, inflado=0.55)
        z = pos(o)[:, 2]; z0, z1 = z.min(), z.max()
        pintar_fn(o, lambda P, N, C: np.ones((len(P), 3)) * (sombra + (luz - sombra) * np.clip(0.5 * (P[:, 2] - z0) / (z1 - z0 + 1e-6) + 0.5 * (N[:, 2] * 0.5 + 0.5), 0, 1) ** 1.3)[:, None])
        variar(o, 0.2, 0.9, semilla + 3 + gi, tono)
        partes.append(o)
    return partes


# ── especies ──
def _roble(lod, semilla, alto=4.6, r0=0.5):
    rng = azar(semilla)
    tr, eje, rad = tronco(alto, r0, lod, rng, inclinar=0.5, lobulos=5, nervio=0.32, pie=1.15, torcer=1.2, punta=0.45)
    rz = raices(r0, lod, rng, 5, 1.7)
    rm, puntas = ramas(eje, rad, lod, rng, n=5, t0=0.5, t1=0.95, largo=3.3, subir=0.9, caos=0.3, hijas=2, grosor=0.55)
    madera = corteza([tr] + rz + rm, rng, cuanto_musgo=0.75, alto=alto + 2)
    cima = eje[-1] + [0, 0, 1.3]
    hj = copa(np.vstack([puntas, [cima]]), lod, rng, radio=1.15, semilla=semilla, tono=(1.5, 1.35, 0.7))
    return unir(madera + hj)


@modelo('roble_a', sustituye={'flora': 'redondo', 'zonas': ['pueblo', 'amanecer']})
def roble_a(lod): return _roble(lod, 11)
