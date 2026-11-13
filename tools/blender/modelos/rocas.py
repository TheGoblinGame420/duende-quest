# ═══════════════════════════════════════════════════════
# DUENDE QUEST — familia ROCAS Y NATURALEZA MENOR (Blender 5.3, sin ventana)
#
#   node tools/blender/construir.mjs rocas
#   node tools/blender/construir.mjs --foto rocas <modelo|a,b|todos> <salida.png>
#
# Sustituye la flora sembrada que seguia con el kit o con figuras sencillas:
#   roca    17 modelos en 5 paletas por zona (granito con musgo, arenisca, granito nevado, pizarra, basalto)
#   pilar   menhir con runas, columna rota y obelisco (castillo)
#   cristal racimos de prismas que brillan (cavernas: verde agua; acantilados: violeta)
#   magico  arbol arcano de copa luminosa (acantilados)
#   hongo   setas grandes (una de ellas bioluminiscente)
#   flor    margaritas ambar, tarwi violeta y cantuta roja
#   hierba  mata de ichu, helecho y mata de hoja ancha
#   palma   palmera de tronco anillado (abismo)
# Mismas posiciones, colisiones y densidad: solo cambia la malla. Todo original, modelado por codigo.
# ═══════════════════════════════════════════════════════
import math
import numpy as np
import bmesh
from dq_lib import *

PI2 = math.pi * 2


# ── ayudas propias de la familia ──
def h1(x, s=0.0):
    """Azar 0..1 estable por indice (capa, anillo...)."""
    v = np.sin(np.asarray(x, dtype=float) * 12.9898 + s * 78.233) * 43758.5453
    return v - np.floor(v)


def mezcla(a, b, t):
    a = hexlin(a); b = hexlin(b); t = np.asarray(t, dtype=float)
    return a * (1 - t[..., None]) + b * t[..., None] if t.ndim else a * (1 - t) + b * t


def base_de(d):
    """Dos vectores perpendiculares a d (para girar anillos alrededor de un eje)."""
    d = np.asarray(d, dtype=float); d = d / (np.linalg.norm(d) + 1e-9)
    r = np.array([0, 0, 1.0]) if abs(d[2]) < 0.9 else np.array([1.0, 0, 0])
    u = np.cross(r, d); u /= np.linalg.norm(u); v = np.cross(d, u)
    return u, v, d


class Lote:
    """Acumula piezas sueltas (hojas, petalos, prismas) y las saca en UNA malla con su color y su viento."""
    def __init__(self): self.v = []; self.f = []; self.c = []; self.w = []

    def mas(self, verts, caras, cols, viento=0.0):
        o = len(self.v); n = len(verts)
        self.v += [tuple(map(float, x)) for x in verts]; self.f += [tuple(int(i) + o for i in c) for c in caras]
        cols = np.asarray(cols, dtype=float)
        if cols.ndim == 1: cols = np.tile(cols, (n, 1))
        self.c += [tuple(x) for x in cols]
        self.w += list(np.full(n, viento, dtype=float) if np.isscalar(viento) else np.asarray(viento, dtype=float))
        return self

    def malla(self, marca, nombre='lote', suave=None):
        if not self.v: return None
        o = malla(nombre, self.v, self.f, marca, '#ffffff')
        poner_color(o, np.array(self.c)); poner_viento(o, np.array(self.w))
        if suave is None: o['dq_afilado'] = 1
        else: suavizar(o, suave)
        return o


def g_cinta(puntos, anchos, pliegue=0.0, lado=None):
    """Tira que sigue una linea (hoja de hierba, tallo, foliolo). pliegue > 0: en V con nervio central.
    Devuelve (verts, caras, t por vertice 0..1)."""
    P = np.asarray(puntos, dtype=float); n = len(P)
    W = np.full(n, anchos, dtype=float) if np.isscalar(anchos) else np.asarray(anchos, dtype=float)
    T = np.gradient(P, axis=0); T /= np.linalg.norm(T, axis=1)[:, None] + 1e-9
    verts = []; ts = []; m = 3 if pliegue else 2
    for i in range(n):
        s = np.cross(T[i], [0, 0, 1.0]) if lado is None else np.asarray(lado, dtype=float)
        if np.linalg.norm(s) < 1e-3: s = np.array([1.0, 0, 0])
        s = s / np.linalg.norm(s); up = np.cross(s, T[i])
        if pliegue: verts += [P[i] - s * W[i] + up * pliegue * W[i], P[i], P[i] + s * W[i] + up * pliegue * W[i]]
        else: verts += [P[i] - s * W[i], P[i] + s * W[i]]
        ts += [i / max(1, n - 1)] * m
    caras = []
    for i in range(n - 1):
        for k in range(m - 1):
            a = i * m + k; caras.append((a, a + 1, a + m + 1, a + m))
    return verts, caras, np.array(ts)


def g_torno(perfil, lados=8, centro=(0, 0, 0), eje=(0, 0, 1), fase=0.0):
    """Pieza de torno: perfil [(radio, alto)] girado alrededor de `eje`. El perfil se recorre dejando el exterior
    «a la derecha» (subiendo por fuera, o de dentro afuera por debajo). radio 0 = vertice en el eje.
    Devuelve (verts, caras, indice de perfil por vertice)."""
    u, v, d = base_de(eje); c = np.asarray(centro, dtype=float)
    verts = []; idx = []; anillos = []
    for i, (r, z) in enumerate(perfil):
        if r <= 1e-6:
            anillos.append([len(verts)]); verts.append(c + d * z); idx.append(i)
        else:
            anillos.append(list(range(len(verts), len(verts) + lados)))
            for k in range(lados):
                a = PI2 * k / lados + fase; verts.append(c + d * z + (u * math.cos(a) + v * math.sin(a)) * r); idx.append(i)
    caras = []
    for i in range(len(perfil) - 1):
        A, B = anillos[i], anillos[i + 1]
        if len(A) == 1 and len(B) == 1: continue
        for k in range(lados):
            k2 = (k + 1) % lados
            if len(A) == 1: caras.append((A[0], B[k2], B[k]))
            elif len(B) == 1: caras.append((A[k], A[k2], B[0]))
            else: caras.append((A[k], A[k2], B[k2], B[k]))
    return verts, caras, np.array(idx)


def g_prisma(base, direccion, largo, radio, lados=6, rng=None, punta=0.24, afinar=0.86):
    """Cristal: prisma de `lados` caras que nace en `base`, crece hacia `direccion` y acaba en punta descentrada.
    Devuelve (verts, caras, t por vertice: 0 pie, ~0.76 hombro, 1 punta)."""
    u, v, d = base_de(direccion); b = np.asarray(base, dtype=float); rng = rng or azar(1)
    rs = radio * rng.uniform(0.82, 1.15, lados); f0 = rng.uniform(0, PI2)
    verts = []; ts = []
    for (z, k, t) in ((0.0, 1.0, 0.0), (largo * (1 - punta), afinar, 1 - punta)):
        for i in range(lados):
            a = f0 + PI2 * i / lados; verts.append(b + d * z + (u * math.cos(a) + v * math.sin(a)) * rs[i] * k); ts.append(t)
    verts.append(b + d * largo + (u * rng.uniform(-0.3, 0.3) + v * rng.uniform(-0.3, 0.3)) * radio); ts.append(1.0)
    caras = []
    for i in range(lados):
        j = (i + 1) % lados
        caras.append((i, j, lados + j, lados + i)); caras.append((lados + i, lados + j, 2 * lados))
    return verts, caras, np.array(ts)


# ── piedra ──
def cortar(o, rng, n=8, hondo=(0.06, 0.28), arriba=0.5):
    """Planos de fractura: lo que sobresale de cada plano se aplasta contra el. Deja facetas planas con cantos
    vivos, como la roca partida. arriba: cuanto miran hacia arriba los planos (0 = cortes verticales)."""
    P = pos(o); c = P.mean(0)
    for _ in range(n):
        d = rng.normal(0, 1, 3); d[2] = abs(d[2]) * arriba
        d /= np.linalg.norm(d) + 1e-9
        s = (P - c) @ d; k = s.max() * (1 - rng.uniform(*hondo))
        P = P - d[None, :] * np.maximum(0, s - k)[:, None]
    poner_pos(o, P)
    return o


def piedra(semilla, tam, centro=(0, 0, 0), cortes=8, hondo=(0.06, 0.28), arriba=0.5, bulto=0.2, fino=0.012, subdiv=4, rot=(0, 0, 0), plano=0.0):
    """Un bloque de roca: esfera con bultos grandes, partida por planos de fractura y con grano fino.
    tam: radios (x, y, z). plano: 0..1, aplana techo y base (lajas y estratos). cortes=0: canto rodado."""
    rng = azar(semilla)
    o = primitiva('esfera', 'piedra', 'piedra', '#777777', radio=1.0, subdiv=subdiv)
    desplazar(o, bulto, 0.9, semilla, 2)
    if cortes:
        cortar(o, rng, cortes, hondo, arriba)
        cortar(o, rng, cortes // 2 + 2, (0.01, 0.07), min(1.0, arriba + 0.3))     # desportillados
    if plano:
        P = pos(o); P[:, 2] = np.clip(P[:, 2], -plano, plano); poner_pos(o, P)
    mover(o, (0, 0, 0), (0, 0, 0), tam)
    if fino: desplazar(o, fino, 2.6, semilla + 7, 2)
    mover(o, centro, rot)
    return o


def asentar(o, z=-0.5):
    """Enrasa lo que baja de z y quita las caras de la base (van bajo tierra: no se ven)."""
    aplicar(o)
    P = pos(o); P[:, 2] = np.maximum(P[:, 2], z); poner_pos(o, P)
    bm = bmesh.new(); bm.from_mesh(o.data)
    fs = [f for f in bm.faces if all(v.co.z <= z + 1e-4 for v in f.verts)]
    if fs: bmesh.ops.delete(bm, geom=fs, context='FACES')
    bm.to_mesh(o.data); bm.free(); o.data.update()
    return o


def _capa(P, grosor, semilla, incl=(0.12, 0.05)):
    eje = np.array([incl[0], incl[1], 1.0]); eje /= np.linalg.norm(eje)
    h = (P @ eje) / grosor + ruido(P, 0.5, semilla + 3) * 0.3
    return np.floor(h), h - np.floor(h)


# Paletas por zona. liquen: [(color, cuanto 0..1, escala, fuerza)]; musgo: (color, fuerza); cima: (color, fuerza, umbral)
# es lo que se posa arriba (nieve, arena, polvo). tapa: las caras de arriba van como 'liso' (se quedan con ESTE color
# en vez del musgo de la zona que pone el material).
PAL = {
    'gris': dict(base='#6c6860', veta='#55524c', claro='#8a857a', tierra='#3a3329', musgo=('#34421f', 0.85),
                 liquen=[('#9c9f7c', 0.02, 4.2, 0.6), ('#a8823f', -0.3, 6.0, 0.55)], cima=None, tapa=False),
    'arenisca': dict(base='#b3915f', veta='#96633f', claro='#d4b784', tierra='#9a8055', musgo=None,
                     liquen=[('#d3bb8c', 0.05, 1.6, 0.5)], cima=('#c9b27c', 0.8, 0.62), tapa=True),
    'nevada': dict(base='#666870', veta='#484a52', claro='#858890', tierra='#3b3d44', musgo=None,
                   liquen=[('#8c7a4c', -0.1, 3.2, 0.55)], cima=('#eef3f8', 1.0, 0.42), tapa=True),
    'pizarra': dict(base='#4b4d59', veta='#34363f', claro='#6a6d7c', tierra='#26272c', musgo=('#3d4a34', 0.6),
                    liquen=[('#7f8c6c', 0.08, 2.6, 0.6)], cima=None, tapa=True),
    'basalto': dict(base='#3c4146', veta='#2a2e33', claro='#56606a', tierra='#1f2326', musgo=None,
                    liquen=[('#2f6f6a', 0.1, 1.9, 0.55)], cima=('#4a6260', 0.55, 0.7), tapa=True),
    'ruina': dict(base='#6d6f72', veta='#56585c', claro='#8d9094', tierra='#33312d', musgo=('#34421f', 0.8),
                  liquen=[('#9c9f7c', 0.0, 4.2, 0.6), ('#a8823f', -0.32, 6.0, 0.5)], cima=None, tapa=False),
}


def pintar_roca(o, pal, semilla, capas=None, marca='piedra'):
    """Color horneado de la piedra: vetas por capas, manchas, grano, pie humedo, liquenes, musgo y lo que se posa
    arriba. capas: (grosor en metros, contraste 0..1)."""
    pal = PAL[pal] if isinstance(pal, str) else pal
    P = pos(o)
    C = np.tile(hexlin(pal['base']), (len(P), 1))
    if capas:
        capa, f = _capa(P, capas[0], semilla)
        t = (h1(capa, semilla + 1) * capas[1])[:, None]
        C = C * (1 - t) + hexlin(pal['veta']) * t
        C *= (1 - 0.25 * np.exp(-(np.minimum(f, 1 - f) / 0.16) ** 2))[:, None]      # junta oscura entre capas
    C *= (1 + 0.24 * ruido_fbm(P, 0.8, semilla + 11, 3))[:, None]
    k = (np.clip(ruido_fbm(P, 1.7, semilla + 5, 2) * 1.6, 0, 1) * 0.4)[:, None]
    C = C * (1 - k) + hexlin(pal['claro']) * k
    C *= (1 + 0.08 * ruido(P, 7.0, semilla + 2))[:, None]
    poner_color(o, C)
    manchar(o, pal['tierra'], lambda P, N: 0.95 - (P[:, 2] + 0.12) / 0.6, 0.78, 2.5, semilla + 21, 0.3)
    for i, (color, cuanto, escala, fuerza) in enumerate(pal.get('liquen') or []):
        manchar(o, color, lambda P, N, c=cuanto, e=escala, s=semilla + 31 + i * 7: (0.3 + c + ruido_fbm(P, e, s, 2) * 1.4) * (N[:, 2] > -0.3), fuerza, escala * 2.2, semilla + 41 + i, 0.15)
    if pal.get('musgo'):
        manchar(o, pal['musgo'][0], lambda P, N: 0.12 + np.clip(0.9 - P[:, 2], 0, 1) * 0.42 + N[:, 2] * 0.22 + N[:, 1] * 0.22, pal['musgo'][1], 1.6, semilla + 51, 0.5)
    if pal.get('cima'):
        col, fuerza, umbral = pal['cima']
        manchar(o, col, lambda P, N: N[:, 2] - umbral + 0.5, fuerza, 2.2, semilla + 61, 0.22)
    desgastar(o, 0.45, 0.4)
    marcar(o, marca)
    if pal.get('tapa'): marcar(o, 'liso', lambda C, N: N[:, 2] > 0.52)
    return o


def roca(piezas, pal, semilla, tris, angulo=28, capas=None, extra=None, marca='piedra'):
    """Junta bloques, los asienta en el suelo, los ajusta al limite de triangulos y los pinta.
    angulo: cantos de mas de esos grados quedan vivos (facetas de roca partida)."""
    o = unir([p for p in piezas if p is not None])
    if tris in T_ROCA: angulo += (0, 8, 18)[T_ROCA.index(tris)]      # de lejos, menos cantos vivos (y menos vertices)
    asentar(o); decimar(o, tris - (extra_tris(extra) if extra else 0))
    pintar_roca(o, pal, semilla, capas, marca)
    suavizar(o, angulo)
    return unir([o] + list(extra)) if extra else o


def extra_tris(objs):
    return sum(contar_tris(o) for o in objs if o is not None)


def _penasco(s, pal, tris, capas=None, extra=None):
    """Peñasco: un bloque grande fracturado con dos piedras caidas al pie."""
    rng = azar(s); a = rng.uniform(0, PI2)
    return roca([
        piedra(s, (1.2, 1.0, 1.08), (-0.12, 0.05, 0.42), 9, (0.1, 0.5), 0.4, 0.16, rot=(0.06, -0.1, a)),
        piedra(s + 5, (0.85, 0.72, 0.66), (0.62, 0.38, 0.2), 8, (0.08, 0.42), 0.5, 0.16, subdiv=3, rot=(-0.12, 0.2, a + 1.9)),
        piedra(s + 1, (0.52, 0.44, 0.38), (1.02, -0.5, 0.02), 7, subdiv=3, rot=(0, 0, a * 2)),
        piedra(s + 2, (0.36, 0.3, 0.27), (-0.92, 0.72, -0.05), 6, subdiv=3),
    ], pal, s, tris, 28, capas, extra)


def _cantos(s, pal, tris, capas=None):
    """Cantos rodados: cuatro piedras lisas y redondas, de mayor a menor, apoyadas unas en otras."""
    return roca([
        piedra(s, (0.92, 0.72, 0.56), (-0.2, 0.1, 0.22), 0, bulto=0.13, fino=0.012, rot=(0.1, 0, 0.4)),
        piedra(s + 1, (0.6, 0.52, 0.4), (0.82, -0.28, 0.1), 0, bulto=0.12, fino=0.012, subdiv=3, rot=(0, 0.15, 1.3)),
        piedra(s + 2, (0.46, 0.36, 0.3), (0.3, 0.78, 0.02), 0, bulto=0.12, fino=0.01, subdiv=3, rot=(0, 0, 2.1)),
        piedra(s + 3, (0.3, 0.25, 0.2), (-0.7, -0.72, -0.03), 0, bulto=0.1, fino=0.01, subdiv=3),
        piedra(s + 4, (0.22, 0.18, 0.15), (1.02, 0.52, -0.06), 0, bulto=0.1, fino=0.01, subdiv=2),
    ], pal, s, tris, 62, capas)


def _losa(s, pal, tris, capas=(0.27, 0.75), n=5, incl=0.2):
    """Afloramiento en estratos: capas de roca apiladas, cada una con su vuelo, ladeadas."""
    rng = azar(s); a = rng.uniform(0, PI2); pz = []
    for i in range(n):
        k = 1 - 0.13 * i + rng.uniform(-0.06, 0.06)
        p = piedra(s + i, (1.42 * k, 1.12 * k * rng.uniform(0.85, 1.1), 0.25), (0.14 * i * math.cos(a) + rng.uniform(-0.1, 0.1), 0.14 * i * math.sin(a) + rng.uniform(-0.1, 0.1), -0.22 + i * 0.27),
                   9, (0.04, 0.3), 0.06, 0.16, 0.02, subdiv=3, rot=(0, 0, rng.uniform(0, PI2)), plano=0.56)
        pz.append(p)
    o = unir(pz); mover(o, (0, 0, 0.1), (incl * math.cos(a + 1.2), incl * math.sin(a + 1.2), 0))
    pz = [o, piedra(s + 9, (0.4, 0.34, 0.2), (-1.25, 0.5, 0.0), 7, subdiv=3, plano=0.6)]
    return roca(pz, pal, s, tris, 26, capas)


def _aguja(s, pal, tris, capas=None, extra=None):
    """Piedra alta de pie, ladeada, con cortes casi verticales."""
    rng = azar(s)
    p = piedra(s, (0.78, 0.66, 1.72), (0, 0, 1.12), 11, (0.05, 0.3), 0.22, 0.24, rot=(0.07, 0.1, rng.uniform(0, PI2)))
    return roca([p,
        piedra(s + 1, (0.5, 0.42, 0.5), (0.72, 0.3, 0.1), 8, subdiv=3),
        piedra(s + 2, (0.34, 0.3, 0.24), (-0.66, -0.5, -0.04), 6, subdiv=3),
    ], pal, s, tris, 28, capas, extra)


def _monton(s, pal, tris, capas=None):
    """Monton de bloques angulosos, como un derrumbe."""
    rng = azar(s); pz = []
    for i, (x, y, z, r) in enumerate([(0, 0, 0.3, 0.72), (0.85, 0.2, 0.12, 0.55), (-0.75, 0.42, 0.1, 0.5), (0.1, -0.85, 0.08, 0.48), (0.3, 0.3, 0.95, 0.46), (-0.55, -0.5, 0.04, 0.34), (0.95, -0.7, -0.02, 0.3)]):
        pz.append(piedra(s + i, (r * rng.uniform(0.9, 1.25), r * rng.uniform(0.75, 1.0), r * rng.uniform(0.6, 0.85)), (x, y, z), 10, (0.1, 0.42), 0.6, 0.15, subdiv=3,
                         rot=(rng.uniform(-0.35, 0.35), rng.uniform(-0.35, 0.35), rng.uniform(0, PI2))))
    return roca(pz, pal, s, tris, 28, capas)


def _lajas(s, pal, tris, capas=(0.12, 0.6)):
    """Lajas de pizarra: placas finas partidas, unas echadas y otras clavadas de canto."""
    rng = azar(s); pz = []
    for i, (x, y, z, rx, ry, k) in enumerate([(0, 0, 0.05, 0.1, 0.05, 1.0), (0.15, 0.1, 0.24, -0.08, 0.12, 0.85), (-0.1, 0.25, 0.42, 0.14, -0.1, 0.66),
                                               (0.75, -0.2, 0.55, 0.2, 1.15, 0.8), (-0.8, -0.35, 0.4, 1.05, 0.15, 0.66), (0.2, 0.85, 0.3, -0.9, 0.3, 0.52), (-0.5, 0.75, 0.0, 0.1, 0.2, 0.45)]):
        pz.append(piedra(s + i, (1.15 * k, 0.82 * k * rng.uniform(0.8, 1.1), 0.2), (x, y, z), 8, (0.05, 0.38), 0.04, 0.12, 0.012, subdiv=3, rot=(rx, ry, rng.uniform(0, PI2)), plano=0.42))
    return roca(pz, pal, s, tris, 26, capas)


def _columnas(s, pal, tris, extra=None):
    """Basalto en columnas: prismas de seis caras de alturas distintas, apretados."""
    rng = azar(s); L = Lote(); R = 0.36
    celdas = [(0, 0)] + [(math.cos(k * PI2 / 6 + 0.52), math.sin(k * PI2 / 6 + 0.52)) for k in range(6)] + [(1.72, 0.3), (-1.5, -0.9), (0.4, -1.75)]
    for i, (cx, cy) in enumerate(celdas):
        d = math.hypot(cx, cy); h = max(0.25, (2.3 - d * 0.95) * rng.uniform(0.6, 1.1)); r = R * rng.uniform(0.9, 1.04)
        x = cx * R * 1.74; y = cy * R * 1.74
        v, f, _ = g_torno([(r, -0.5), (r, h * 0.33), (r, h * 0.7), (r * 0.98, h - 0.05), (r * 0.82, h), (0, h + 0.012)], 6, (x, y, 0), (rng.uniform(-0.04, 0.04), rng.uniform(-0.04, 0.04), 1), fase=0.52 + rng.uniform(-0.08, 0.08))
        L.mas(v, f, (0.5, 0.5, 0.5))
    o = L.malla('piedra', 'columnas')
    desplazar(o, 0.025, 2.2, s, 2)
    return roca([o], pal, s, tris, 24, None, extra)


def cristales(puntos, paleta, semilla, lados=6, marca='emisivo'):
    """Racimo de prismas. puntos: [(base xyz, direccion, largo, radio)]. paleta: (pie, medio, punta)."""
    L = Lote()
    for i, (b, d, l, r) in enumerate(puntos):
        rng = azar(semilla * 53 + i)
        v, f, t = g_prisma(b, d, l, r, lados, rng)
        k = rng.uniform(0.8, 1.15)
        c = np.where(t[:, None] < 0.5, mezcla(paleta[0], paleta[1], t / 0.5 * 0.7), mezcla(paleta[1], paleta[2], np.clip((t - 0.5) / 0.5, 0, 1))) * k
        L.mas(v, f, c)
    return L.malla(marca, 'cristales', suave=12)


AGUA = ('#0a3f3d', '#1f9a86', '#7ee0cc')        # cavernas (antes #5eead4)
ARCANO = ('#2c1763', '#7a4fe0', '#c6adff')      # acantilados (antes #c084fc)


def _racimo(s, paleta, lod, forma='aguja'):
    """Cristales que brotan de una piedra madre."""
    n = (7, 4, 3)[lod]
    if forma == 'aguja':
        esp = [((0, 0, -0.2), (0.06, 0.03, 1), 3.75, 0.42), ((0.38, 0.12, -0.2), (0.42, 0.14, 1), 2.5, 0.28), ((-0.34, 0.26, -0.2), (-0.5, 0.3, 1), 2.05, 0.25),
               ((0.02, -0.42, -0.2), (0.1, -0.62, 1), 1.7, 0.22), ((-0.3, -0.3, -0.2), (-0.75, -0.6, 1), 1.25, 0.17), ((0.42, -0.34, -0.2), (0.9, -0.7, 1), 1.0, 0.15), ((0.1, 0.5, -0.2), (0.2, 1.0, 1), 1.2, 0.16)]
    else:
        esp = [((0, 0, -0.2), (-0.2, 0.1, 1), 2.6, 0.4), ((0.5, 0.0, -0.2), (0.75, -0.1, 1), 2.25, 0.33), ((-0.5, -0.1, -0.2), (-0.95, -0.25, 1), 1.95, 0.3),
               ((0.1, 0.5, -0.2), (0.25, 0.9, 1), 1.75, 0.26), ((0.15, -0.5, -0.2), (0.3, -1.1, 1), 1.5, 0.24), ((-0.4, 0.5, -0.2), (-1.0, 1.1, 1), 1.1, 0.18), ((0.62, 0.45, -0.2), (1.4, 0.9, 1), 0.9, 0.15)]
    c = cristales(esp[:n], paleta, s, 6 if lod < 2 else 4)
    if lod == 2: return c
    madre = roca([piedra(s, (0.95, 0.85, 0.42), (0, 0, 0.0), 8, (0.08, 0.3), 0.5, 0.2, subdiv=3),
                  piedra(s + 1, (0.4, 0.34, 0.26), (0.85, -0.45, -0.05), 6, subdiv=2)], 'basalto', s, (84, 36)[lod], 32)
    return [madre, c]


# ── pilares ──
RUNAS = [   # trazos (x0, z0, x1, z1) en una casilla de 1×1, originales
    [(0.1, 0.1, 0.5, 0.9), (0.5, 0.9, 0.9, 0.1), (0.5, 0.9, 0.5, 0.35), (0.3, 0.1, 0.7, 0.1)],
    [(0.15, 0.9, 0.85, 0.65), (0.85, 0.65, 0.15, 0.4), (0.15, 0.4, 0.85, 0.1), (0.5, 0.52, 0.5, 0.28)],
    [(0.1, 0.1, 0.9, 0.1), (0.9, 0.1, 0.9, 0.9), (0.9, 0.9, 0.3, 0.9), (0.3, 0.9, 0.3, 0.45), (0.3, 0.45, 0.62, 0.45)],
    [(0.5, 0.95, 0.9, 0.5), (0.9, 0.5, 0.5, 0.05), (0.5, 0.05, 0.1, 0.5), (0.1, 0.5, 0.5, 0.95), (0.5, 0.7, 0.5, 0.3)],
    [(0.2, 0.1, 0.2, 0.9), (0.2, 0.9, 0.8, 0.6), (0.2, 0.5, 0.8, 0.2), (0.8, 0.6, 0.8, 0.9)],
]


def runas(o, glifos, color, ancho=0.05, fuera=0.022, frente=(0, -1, 0)):
    """Runas talladas que brillan: tiras 'emisivo' proyectadas sobre la piel de `o`.
    glifos: [(indice de RUNAS, x, z, tamaño)] en el plano que mira a `frente`."""
    aplicar(o); me = o.data; P = pos(o)
    bvh = BVHTree.FromPolygons([tuple(p) for p in P], [tuple(p.vertices) for p in me.polygons])
    fr = np.asarray(frente, dtype=float); fr /= np.linalg.norm(fr); lat = np.cross([0, 0, 1.0], fr)
    L = Lote(); col = hexlin(color)
    for (gi, gx, gz, tam) in glifos:
        for (x0, z0, x1, z1) in RUNAS[gi % len(RUNAS)]:
            a = np.array([gx + (x0 - 0.5) * tam, gz + (z0 - 0.5) * tam]); b = np.array([gx + (x1 - 0.5) * tam, gz + (z1 - 0.5) * tam])
            d = b - a; l = np.linalg.norm(d); d /= l; a = a - d * ancho * 0.4; b = b + d * ancho * 0.4
            n = max(1, int(l / 0.16)); pts = []
            for i in range(n + 1):
                q = a + (b - a) * i / n
                h = bvh.ray_cast(Vector(tuple(lat * q[0] + fr * 6 + np.array([0, 0, q[1]]))), Vector(tuple(-fr)))
                if h[0] is None: pts = None; break
                pts.append(np.array(h[0]) + np.array(h[1]) * fuera)
            if not pts: continue
            s = (lat * -d[1] + np.array([0, 0, d[0]])) * ancho * 0.5
            verts = []
            for p in pts: verts += [p - s, p + s]
            caras = []
            for i in range(n):
                c = (i * 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
                nn = np.cross(verts[c[1]] - verts[c[0]], verts[c[3]] - verts[c[0]])
                caras.append(c if nn @ fr > 0 else c[::-1])
            L.mas(verts, caras, col)
    return L.malla('emisivo', 'runas')


def _menhir(lod, s=3):
    """Menhir: piedra hincada de una pieza, afinada y ladeada, con runas violetas en la cara."""
    o = primitiva('cubo', 'menhir', 'monolito', '#77736b', lado=1.0)
    mover(o, (0, 0, 2.2), esc=(1.25, 0.78, 5.4))
    biselar(o, 0.16, 2)
    subdividir(o, 3, simple=True)
    deformar(o, lambda P: P * np.c_[1 - 0.34 * np.clip(P[:, 2] / 4.9, 0, 1) ** 1.5, 1 - 0.25 * np.clip(P[:, 2] / 4.9, 0, 1), np.ones(len(P))] + np.c_[0.2 * (P[:, 2] / 4.9) ** 2, 0.08 * (P[:, 2] / 4.9), np.zeros(len(P))])
    desplazar(o, 0.17, 0.7, s); desplazar(o, 0.045, 3.0, s + 2)
    cortar(o, azar(s), 5, (0.02, 0.1), 0.3)
    pie = [piedra(s + 5, (0.5, 0.42, 0.34), (0.82, -0.35, 0.02), 7, subdiv=3), piedra(s + 6, (0.36, 0.3, 0.24), (-0.8, 0.3, -0.03), 6, subdiv=3)]
    o = unir([o] + pie); asentar(o)
    decimar(o, (640, 220, 78)[lod])
    pintar_roca(o, 'ruina', s, None, 'monolito'); suavizar(o, (38, 44, 50)[lod])
    if lod == 2: return o
    g = [(0, 0.12, 3.5, 0.42), (1, 0.08, 2.86, 0.44), (2, 0.04, 2.2, 0.46), (3, 0.0, 1.52, 0.48)]
    t = [(4, -0.1, 3.3, 0.42), (0, -0.06, 2.62, 0.44), (2, -0.02, 1.9, 0.46)]     # por detras, otras tres
    an = 0.055 if lod == 0 else 0.07
    return [o, runas(o, g if lod == 0 else g[:3], '#7a4fe0', an), runas(o, t if lod == 0 else t[:2], '#7a4fe0', an, frente=(0, 1, 0))]


def _columna(lod, s=5):
    """Columna rota: tambores desencajados sobre un plinto, el de arriba partido y uno caido al pie."""
    rng = azar(s); L = Lote(); z = 0.34; lados = (10, 8, 6)[lod]
    for i in range(4):
        h = 0.92 if i < 3 else 0.7; r = 0.5 - 0.012 * i; dx = rng.uniform(-0.04, 0.04); dy = rng.uniform(-0.04, 0.04)
        v, f, _ = g_torno([(r * 0.9, 0), (r, 0.05), (r, h * 0.5), (r, h - 0.05), (r * 0.9, h), (0, h)], lados, (dx, dy, z), (rng.uniform(-0.012, 0.012), rng.uniform(-0.012, 0.012), 1), fase=rng.uniform(0, 1))
        L.mas(v, f, (0.5, 0.5, 0.5)); z += h
    v, f, _ = g_torno([(0.46, 0), (0.5, 0.05), (0.5, 0.45), (0.5, 0.82), (0.44, 0.9), (0, 0.9)], lados, (1.0, -0.42, 0.2), (0.86, 0.5, 0.12), fase=0.3)   # tambor caido
    L.mas(v, f, (0.5, 0.5, 0.5))
    fuste = L.malla('monolito', 'fuste', suave=40)
    P = pos(fuste); d = np.array([0.5, 0.3, 0.8]); d /= np.linalg.norm(d); k = (P @ d) - 3.42; P = P - d[None, :] * np.maximum(0, k)[:, None]; poner_pos(fuste, P)   # la rotura
    plinto = primitiva('cubo', 'plinto', 'monolito', '#777777', lado=1.0); mover(plinto, (0, 0, -0.08), (0, 0, 0.12), (1.4, 1.4, 0.86)); biselar(plinto, 0.07, 2); subdividir(plinto, 2, simple=True)
    desplazar(plinto, 0.05, 1.6, s)
    cas = [piedra(s + 3, (0.3, 0.26, 0.2), (-0.92, -0.62, -0.02), 7, subdiv=2), piedra(s + 4, (0.22, 0.2, 0.15), (-0.6, 0.9, -0.04), 6, subdiv=2)]
    o = unir([fuste, plinto] + cas); desplazar(o, 0.022, 2.4, s + 1); asentar(o)
    decimar(o, (680, 240, 88)[lod])
    pintar_roca(o, 'ruina', s, (0.92, 0.25), 'monolito')
    return suavizar(o, (36, 42, 50)[lod])


def _obelisco(lod, s=9):
    """Obelisco de cuatro caras con piramidion, sobre dos gradas, desportillado, con una ristra de runas verdes."""
    o = primitiva('cubo', 'obelisco', 'monolito', '#777777', lado=1.0)
    mover(o, (0, 0, 2.75), esc=(0.92, 0.92, 4.9)); biselar(o, 0.05, 1); subdividir(o, 3, simple=True)
    def afinar(P):
        t = np.clip((P[:, 2] - 0.3) / 4.9, 0, 1); k = np.where(t < 0.86, 1 - 0.42 * t / 0.86, 0.58 * np.clip(1 - (t - 0.86) / 0.14, 0.03, 1))
        return P * np.c_[k, k, np.ones(len(P))]
    deformar(o, afinar)
    cortar(o, azar(s), 4, (0.02, 0.09), 0.2); desplazar(o, 0.035, 1.4, s)
    g1 = primitiva('cubo', 'grada', 'monolito', '#777777', lado=1.0); mover(g1, (0, 0, -0.1), (0, 0, 0.06), (1.75, 1.75, 0.8)); biselar(g1, 0.06, 2); subdividir(g1, 2, simple=True)
    g2 = primitiva('cubo', 'grada', 'monolito', '#777777', lado=1.0); mover(g2, (0.02, 0, 0.42), (0, 0, -0.05), (1.3, 1.3, 0.34)); biselar(g2, 0.05, 2); subdividir(g2, 2, simple=True)
    desplazar(g1, 0.06, 1.3, s + 1); desplazar(g2, 0.04, 1.6, s + 2)
    o = unir([o, g1, g2]); asentar(o)
    decimar(o, (660, 230, 80)[lod])
    pintar_roca(o, 'ruina', s, None, 'monolito'); suavizar(o, (34, 40, 50)[lod])
    if lod == 2: return o
    g = [(4, 0, 3.55, 0.3), (2, 0, 3.05, 0.32), (0, 0, 2.5, 0.34), (1, 0, 1.92, 0.36), (3, 0, 1.3, 0.38)]
    return [o, runas(o, g if lod == 0 else g[::2], '#2fc9a6', 0.045 if lod == 0 else 0.06)]


# ── plantas ──
def arco(base, rumbo, largo, subir, caer, n, lado=0.0):
    """Linea que sale de `base` hacia `rumbo` (radianes), sube y se vence por su peso."""
    b = np.asarray(base, dtype=float); d = np.array([math.cos(rumbo), math.sin(rumbo), 0]); q = np.array([-d[1], d[0], 0])
    s = np.linspace(0, 1, n)
    return b[None, :] + d[None, :] * (largo * s * (1 - 0.25 * subir))[:, None] + q[None, :] * (lado * s * s)[:, None] + np.array([0, 0, 1.0])[None, :] * (largo * (subir * s - caer * s * s))[:, None]


def follaje(L, centro=(0, 0, 0.05), peso=0.85):
    """Cierra un lote de hojas: dos caras, normales redondeadas y marca 'hoja'."""
    o = L.malla('hoja', 'hojas')
    if o is None: return None
    inflar(o, [centro], peso); dos_caras(o); o['dq_afilado'] = 1
    return o


def lamina(L, marca, centro=(0, 0, 0.05), peso=0.8):
    o = L.malla(marca, 'laminas')
    if o is None: return None
    inflar(o, [centro], peso); dos_caras(o); o['dq_afilado'] = 1
    return o


ORO = 2.39996      # angulo aureo: cualquier prefijo de la serie queda bien repartido (los niveles bajos quitan piezas sin mover las demas)


def g_tubo(puntos, radios, lados=3):
    """Tubo fino que sigue una linea (tallos): no desaparece de canto como una tira. (verts, caras, t)."""
    P = np.asarray(puntos, dtype=float); n = len(P)
    R = np.full(n, radios, dtype=float) if np.isscalar(radios) else np.asarray(radios, dtype=float)
    verts = []; ts = []; caras = []; u = None
    for i in range(n):
        d = P[min(i + 1, n - 1)] - P[max(i - 1, 0)]; d = d / (np.linalg.norm(d) + 1e-9)
        if u is None: u = base_de(d)[0]
        u = u - d * (u @ d); u = u / (np.linalg.norm(u) + 1e-9); v = np.cross(d, u)
        for k in range(lados):
            a = PI2 * k / lados; verts.append(P[i] + (u * math.cos(a) + v * math.sin(a)) * R[i]); ts.append(i / max(1, n - 1))
    for i in range(n - 1):
        for k in range(lados):
            k2 = (k + 1) % lados; caras.append((i * lados + k, i * lados + k2, (i + 1) * lados + k2, (i + 1) * lados + k))
    return verts, caras, np.array(ts)


def hojas_de_mata(L, semilla, n, largo, ancho, seg, subir=(0.9, 1.5), caer=(0.5, 1.1), c0=(0.42, 0.5, 0.36), c1=(1.25, 1.2, 0.8), radio=0.05, pliegue=0.0):
    for i in range(n):
        rng = azar(semilla * 977 + i)
        a = ORO * i + rng.uniform(-0.3, 0.3); l = largo * rng.uniform(0.6, 1.1)
        b = (math.cos(a) * radio * rng.uniform(0.2, 1.4), math.sin(a) * radio * rng.uniform(0.2, 1.4), -0.04)
        p = arco(b, a, l, rng.uniform(*subir), rng.uniform(*caer), seg + 1, rng.uniform(-0.12, 0.12) * l)
        s = np.linspace(0, 1, seg + 1); w = ancho * rng.uniform(0.8, 1.2) * (1 - s ** 1.6 * 0.94) * (0.55 + 0.45 * np.minimum(1, s * 4))
        v, f, t = g_cinta(p, w, pliegue)
        k = rng.uniform(0.82, 1.15)
        L.mas(v, f, (np.asarray(c0)[None, :] * (1 - t[:, None]) + np.asarray(c1)[None, :] * t[:, None]) * k, 0.25 + 0.75 * t)


def tallo(T, p, radio, c0=(0.45, 0.55, 0.38), c1=(0.85, 0.95, 0.6), v0=0.2, lados=3):
    v, f, t = g_tubo(p, radio, lados)
    T.mas(v, f, np.asarray(c0)[None, :] * (1 - t[:, None]) + np.asarray(c1)[None, :] * t[:, None], v0 + (1 - v0) * t)


def tallos(T, centro=(0, 0, 0.1)):
    o = T.malla('hoja', 'tallos')
    if o is None: return None
    inflar(o, [centro], 0.5); o['dq_afilado'] = 1
    return o


def _ichu(lod, s=1):
    """Mata de ichu: hojas finas que salen en haz y se vencen; las puntas, pajizas."""
    L = Lote()
    hojas_de_mata(L, s, (36, 14, 9)[lod], 0.92, (0.03, 0.046, 0.08)[lod], (2, 2, 1)[lod], (1.3, 2.4), (0.45, 1.35), (0.3, 0.4, 0.3), (1.9, 1.5, 0.75), 0.09)
    return follaje(L)


def _fronda(L, rng, a, largo, ancho, seg, subir, caer, pliegue, sierra, c0, c1, nervio):
    p = arco((math.cos(a) * 0.03, math.sin(a) * 0.03, -0.04), a, largo, subir, caer, seg + 1, rng.uniform(-0.1, 0.1))
    t = np.linspace(0, 1, seg + 1); w = ancho * np.sin(np.clip(t * 0.96 + 0.08, 0, 1) * math.pi) ** 0.7
    if sierra: w = w * np.where(np.arange(seg + 1) % 2 == 0, 1.0, sierra)
    v, f, tt = g_cinta(p, w + 0.006, pliegue)
    c = np.asarray(c0)[None, :] * (1 - tt[:, None]) + np.asarray(c1)[None, :] * tt[:, None]
    if pliegue: c[1::3] *= nervio
    L.mas(v, f, c * rng.uniform(0.85, 1.12), 0.2 + 0.8 * tt)


def _helecho(lod, s=2):
    """Helecho: frondas en V con el borde en sierra, abiertas en roseta."""
    L = Lote()
    for i in range((8, 5, 4)[lod]):
        rng = azar(s * 131 + i)
        _fronda(L, rng, ORO * i + rng.uniform(-0.2, 0.2), 0.82 * rng.uniform(0.75, 1.1), (0.17, 0.19, 0.24)[lod], (5, 3, 2)[lod], rng.uniform(1.0, 1.6), rng.uniform(0.8, 1.15),
                (0.3, 0.3, 0.0)[lod], (0.6, 0.0, 0.0)[lod], (0.38, 0.5, 0.34), (1.05, 1.15, 0.75), 0.62)
    return follaje(L)


def _llanten(lod, s=3):
    """Mata de hoja ancha con nervio y dos espigas de semilla."""
    L = Lote(); T = Lote(); E = Lote()
    for i in range((7, 5, 4)[lod]):
        rng = azar(s * 131 + i)
        _fronda(L, rng, ORO * i + rng.uniform(-0.25, 0.25), 0.5 * rng.uniform(0.75, 1.15), (0.13, 0.14, 0.18)[lod], (4, 2, 2)[lod], rng.uniform(0.9, 1.6), rng.uniform(0.6, 1.0),
                (0.35, 0.35, 0.0)[lod], 0.0, (0.4, 0.5, 0.36), (1.1, 1.12, 0.8), 1.35)
    for i in range((2, 1, 0)[lod]):
        rng = azar(s * 71 + i); a = rng.uniform(0, PI2); p = arco((0, 0, 0), a, 0.42, 2.0, 0.25, 3)
        tallo(T, p, 0.009, (0.6, 0.7, 0.45), (0.8, 0.85, 0.5), 0.3)
        d = p[-1] - p[-2]
        v, f, ix = g_torno([(0.008, 0), (0.026, 0.06), (0.03, 0.2), (0.018, 0.33), (0, 0.4)], (5, 4, 3)[lod], p[-1], d)
        E.mas(v, f, mezcla('#6b5a34', '#b79a58', ix / 4.0), 0.9)
    esp = E.malla('liso', 'espigas')
    if esp is not None: inflar(esp, [(0, 0, 0.3)], 0.5)
    return [follaje(L), tallos(T), esp]


def _margaritas(lod, s=1, petalo='#d6a04a', centro='#4a3018', claro='#f0d490'):
    """Mata de flores de petalos abiertos sobre tallos finos, con hojas al pie."""
    H = Lote(); T = Lote(); F = Lote(); K = Lote(); np_ = (6, 5, 4)[lod]
    if lod < 2: hojas_de_mata(H, s + 50, (8, 4)[lod], 0.42, (0.04, 0.055)[lod], (2, 1)[lod], (0.8, 1.5), (0.5, 1.0), radio=0.05)
    for i in range((5, 4, 3)[lod]):
        rng = azar(s * 131 + i); a = ORO * i + rng.uniform(-0.3, 0.3); alto = 0.7 if i == 0 else rng.uniform(0.4, 0.62)
        p = arco((math.cos(a) * 0.03, math.sin(a) * 0.03, -0.03), a, alto, 2.2, 0.35, (4, 3, 2)[lod], rng.uniform(-0.06, 0.06))
        tallo(T, p, (0.008, 0.011, 0.016)[lod])
        e0 = arco((0, 0, 0), a, alto, 2.2, 0.35, 4); d = e0[-1] - e0[-2]; d = d / np.linalg.norm(d); d = d * 0.6 + np.array([math.cos(a) * 0.35, math.sin(a) * 0.35, 0.55]); u, v, d = base_de(d)
        r = 0.125 * rng.uniform(0.85, 1.2); c = p[-1]; w = 1.0
        for k in range(np_):
            b = PI2 * k / np_ + rng.uniform(-0.1, 0.1); e = u * math.cos(b) + v * math.sin(b); q = np.cross(d, e)
            an = r * (0.5 if lod == 0 else 0.62)
            F.mas([c + e * r * 0.2 - q * an * 0.5, c + e * r * 0.2 + q * an * 0.5, c + e * r + q * an * 0.62 + d * r * 0.3, c + e * r - q * an * 0.62 + d * r * 0.3], [(0, 1, 2, 3)],
                  [hexlin(petalo) * 0.7, hexlin(petalo) * 0.7, hexlin(claro), hexlin(claro)], w)
        if lod < 2:
            vv, ff, ix = g_torno([(r * 0.32, 0.0), (r * 0.25, r * 0.17), (0, r * 0.24)], (5, 4)[lod], c, d)
            K.mas(vv, ff, hexlin(centro) * 1.2, w)
    return [follaje(H), tallos(T), lamina(F, 'liso', (0, 0, 0.2), 0.55), K.malla('liso', 'centros', suave=60)]


def _tarwi(lod, s=2):
    """Tarwi (lupino andino): espigas violetas en pisos, mas palidas hacia la punta, y hojas en estrella."""
    H = Lote(); T = Lote(); F = Lote(); lados = (4, 4, 3)[lod]
    for i in range((4, 2, 1)[lod]):     # hojas palmeadas
        rng = azar(s * 57 + i); a = ORO * i + 1.0 + rng.uniform(-0.3, 0.3); p = arco((0, 0, -0.03), a, 0.3 * rng.uniform(0.8, 1.2), 1.6, 0.6, 2)
        tallo(T, p, (0.007, 0.01, 0.014)[lod]); c = p[-1]; u, v, d = base_de((math.cos(a) * 0.4, math.sin(a) * 0.4, 1))
        m = (5, 3, 3)[lod]
        for k in range(m):
            b = PI2 * k / m; e = u * math.cos(b) + v * math.sin(b); q = np.cross(d, e); r = 0.15 * rng.uniform(0.85, 1.15)
            H.mas([c, c + e * r * 0.55 + q * r * 0.26 + d * 0.012, c + e * r - d * 0.012, c + e * r * 0.55 - q * r * 0.26 + d * 0.012], [(0, 1, 2, 3)], [(0.6, 0.7, 0.5), (0.95, 1.0, 0.7), (1.15, 1.15, 0.8), (0.95, 1.0, 0.7)], 0.5)
    for i in range((4, 3, 2)[lod]):
        rng = azar(s * 131 + i); a = ORO * i + rng.uniform(-0.3, 0.3); alto = (0.4 if i else 0.46) * rng.uniform(0.75, 1.0)
        p = arco((math.cos(a) * 0.02, math.sin(a) * 0.02, -0.03), a, alto, 2.6, 0.2 if i else 0.02, (3, 2, 2)[lod], rng.uniform(-0.04, 0.04))
        tallo(T, p, (0.009, 0.012, 0.016)[lod])
        e0 = arco((0, 0, 0), a, alto, 2.6, 0.2 if i else 0.02, 3); d = e0[-1] - e0[-2]
        lar = 0.4 * rng.uniform(0.85, 1.15); pisos = (4, 2, 1)[lod]; perfil = [(0.014, 0.0)]; cols = [0.0]
        for k in range(pisos):
            z0 = lar * k / pisos; z1 = lar * (k + 0.75) / pisos; r = 0.075 * (1 - 0.7 * k / pisos)
            perfil += [(r, z0 + lar * 0.12 / pisos), (r * 0.42, z1)]; cols += [k / pisos, k / pisos + 0.08]
        perfil.append((0, lar * 1.04)); cols.append(1.0)
        v, f, ix = g_torno(perfil, lados, p[-1], d, fase=rng.uniform(0, 1))
        t = np.array(cols)[ix]; c = mezcla('#4d3a94', '#8e74d8', t); c = np.where((t > 0.72)[:, None], mezcla('#8e74d8', '#d9cdf2', np.clip((t - 0.72) / 0.28, 0, 1)), c)
        c[ix % 2 == 0] *= 0.72
        F.mas(v, f, c, 0.85)
    fl = F.malla('liso', 'espigas')
    inflar(fl, [(0, 0, 0.3)], 0.45)
    return [follaje(H), tallos(T), fl]


def _cantuta(lod, s=3):
    """Cantuta: tallos leñosos que se arquean y campanas rojas colgando, amarillas en el cuello."""
    H = Lote(); T = Lote(); F = Lote(); lados = (4, 3, 3)[lod]
    for i in range((4, 3, 2)[lod]):
        rng = azar(s * 131 + i); a = ORO * i + rng.uniform(-0.25, 0.25); l = 0.78 * rng.uniform(0.75, 1.05); seg = (5, 3, 2)[lod]
        p = arco((math.cos(a) * 0.03, math.sin(a) * 0.03, -0.03), a, l, 1.75, 0.9, seg + 1, rng.uniform(-0.08, 0.08))
        tallo(T, p, (0.011, 0.014, 0.018)[lod], (0.5, 0.45, 0.3), (0.8, 0.85, 0.5))
        for j in range(1, seg + 1):        # hojitas a lo largo, alternas
            if lod == 2 and j % 2: continue
            q = np.array([-math.sin(a), math.cos(a), 0]) * (-1, 1)[j % 2]; c = p[j] * 0.6 + p[j - 1] * 0.4; r = 0.13 if lod == 0 else 0.16
            H.mas([c, c + q * r * 0.5 + np.array([0, 0, 0.035]), c + q * r + np.array([0, 0, 0.01]), c + q * r * 0.5 - np.array([0, 0, 0.02])], [(0, 1, 2, 3)], [(0.5, 0.6, 0.42), (0.9, 1.0, 0.7), (1.1, 1.15, 0.8), (0.8, 0.9, 0.6)], 0.3 + 0.6 * j / seg)
        for j in ((seg, seg - 1)[:(2, 1, 1)[lod]]):   # campanas en la punta del arco
            c = p[j] + np.array([rng.uniform(-0.02, 0.02), rng.uniform(-0.02, 0.02), -0.012]); lar = 0.21 * rng.uniform(0.85, 1.15)
            eje = (math.cos(a) * 0.3 + rng.uniform(-0.15, 0.15), math.sin(a) * 0.3 + rng.uniform(-0.15, 0.15), -1)
            # la campana cuelga: el perfil va del cuello (arriba) a la boca (abajo) y se cierra por dentro
            pf = [(0.0, lar * 1.02), (0.06, lar), (0.034, lar * 0.72), (0.026, lar * 0.3), (0.015, 0.0)][::-1]
            cols = [hexlin('#d79a2e'), hexlin('#c9552c'), hexlin('#a82438'), hexlin('#c23a4c'), hexlin('#5a1420')]
            if lod == 2: pf = [pf[0], pf[3], pf[4]]; cols = [cols[0], cols[3], cols[4]]
            v, f, ix = g_torno(pf, lados, c, eje)
            F.mas(v, f, np.array(cols)[ix], 0.35 + 0.6 * j / seg)
    fl = F.malla('liso', 'campanas')
    inflar(fl, [(0, 0, 0.35)], 0.4)
    return [follaje(H), tallos(T), fl]


def _seta(L, G, base, alto, radio, rng, lados, anillos, sombrero, borde, laminas, pie='#c9bfa6', brillo=None, incl=0.25, completa=True, por_debajo=True):
    """Una seta: pie curvo que se ensancha abajo y sombrero abombado con laminas por debajo.
    L: lote 'liso'; G: lote de lo que brilla (o None)."""
    a = rng.uniform(0, PI2); b = np.asarray(base, dtype=float)
    top = b + np.array([math.cos(a) * alto * incl, math.sin(a) * alto * incl, alto])
    mid = b + np.array([math.cos(a) * alto * incl * 0.2, math.sin(a) * alto * incl * 0.2, alto * 0.5])
    pts = curva([b + np.array([0, 0, -0.08]), mid, top], anillos); rp = radio * 0.27
    rs = [rp * (1.55 - 0.65 * min(1, i / (anillos - 1) * 2.2)) for i in range(anillos)]
    # el pie, como anillos a lo largo de la curva
    u, v, d = base_de(pts[1] - pts[0]); verts = []; caras = []; cols = []
    for i in range(anillos):
        for k in range(lados):
            ang = PI2 * k / lados; verts.append(pts[i] + (u * math.cos(ang) + v * math.sin(ang)) * rs[i]); cols.append(hexlin(pie) * (0.62 + 0.38 * i / (anillos - 1)))
    for i in range(anillos - 1):
        for k in range(lados):
            k2 = (k + 1) % lados; caras.append((i * lados + k, i * lados + k2, (i + 1) * lados + k2, (i + 1) * lados + k))
    L.mas(verts, caras, cols)
    eje = pts[-1] - pts[-2]; eje = eje / np.linalg.norm(eje) * 0.5 + np.array([0, 0, 0.5]); R = radio; h = radio * 0.62
    # por debajo, de dentro afuera (laminas); luego el borde y la cupula hasta el centro
    bajo = [(rs[-1] * 1.02, -h * 0.02), (R * 0.55, -h * 0.1), (R * 0.97, -h * 0.02)]
    cima = [(R, h * 0.06), (R * 0.93, h * 0.3), (R * 0.72, h * 0.62), (R * 0.4, h * 0.88), (0, h)] if completa else [(R, h * 0.06), (R * 0.72, h * 0.62), (0, h)]
    if por_debajo:
        vv, ff, ix = g_torno(bajo, lados, top, eje, fase=a)
        (G if (G is not None and brillo) else L).mas(vv, ff, np.array([hexlin(brillo or laminas) * k for k in (0.5, 0.85, 1.0)])[ix])
    vv, ff, ix = g_torno([bajo[-1]] + cima, lados, top, eje, fase=a)
    tt = ix / float(len(cima)); c = mezcla(borde, sombrero, np.clip(tt * 2.2, 0, 1)) * (1 + 0.12 * np.cos(np.arange(len(ix)) * 2.4))[:, None]
    c[ix == 0] = hexlin(borde) * 0.85
    L.mas(vv, ff, c)


def _setas(lod, s, grupo, sombrero, borde, laminas, brillo=None, lados=(7, 5, 4)):
    rng = azar(s); L = Lote(); G = Lote() if brillo else None
    lados = lados[lod]; anillos = (3, 3, 2)[lod]
    for (x, y, alto, r) in grupo[:(len(grupo), max(2, len(grupo) - 1), 2)[lod]]:
        _seta(L, G, (x, y, 0), alto, r, rng, lados, anillos, sombrero, borde, laminas, brillo=brillo, completa=lod == 0, por_debajo=lod < 2 or bool(brillo))
    o = L.malla('liso', 'setas', suave=50)
    variar(o, 0.14, 4.0, s)
    g = G.malla('emisivo', 'laminas', suave=50) if (G and G.v) else None
    return [o, g]


# ── palmera ──
def _palma(lod, s=1, alto=7.4, curva_=1.3, n_hojas=10):
    """Palmera: tronco anillado que se curva, penacho de frondas en V con borde en sierra, frondas secas colgando y cocos."""
    rng = azar(s); a0 = rng.uniform(0, PI2); dx = math.cos(a0) * curva_; dy = math.sin(a0) * curva_
    an = (13, 8, 4)[lod]; lados = (7, 6, 4)[lod]
    eje = curva([(0, 0, -0.7), (dx * 0.08, dy * 0.08, alto * 0.3), (dx * 0.45, dy * 0.45, alto * 0.68), (dx, dy, alto)], an)
    t = np.linspace(0, 1, an); rad = 0.24 * (1 - 0.42 * t) + 0.2 * np.exp(-t * 9) + (0.02 * (np.arange(an) % 2) if lod == 0 else 0) + 0.06 * np.exp(-((t - 1) / 0.06) ** 2)
    tr = tubo(eje, rad, lados, 'tronco', 'madera', '#6b5a44', punta=True)
    P = pos(tr); z = np.clip((P[:, 2] + 0.7) / (alto + 0.7), 0, 1)
    anillo = 0.78 + 0.36 * ((np.arange(len(P)) // lados) % 2) if lod == 0 else 1.0
    poner_color(tr, np.tile(hexlin('#6f5d47'), (len(P), 1)) * (anillo * (0.8 + 0.3 * z) * (1 + 0.14 * ruido(P, 2.0, s)))[:, None] if lod == 0 else np.tile(hexlin('#6f5d47'), (len(P), 1)) * (0.8 + 0.3 * z)[:, None])
    manchar(tr, '#34421f', lambda P, N: 0.75 - P[:, 2] / 1.6 + N[:, 1] * 0.2, 0.6, 2.0, s + 3, 0.4)
    poner_viento(tr, np.clip(z, 0, 1) ** 2 * 0.55)
    top = eje[-1]; H = Lote(); S = Lote()
    n = (n_hojas, 8, 6)[lod]; seg = (8, 4, 2)[lod]
    for i in range(n):
        rng = azar(s * 131 + i); a = ORO * i + rng.uniform(-0.2, 0.2); piso = i % 3; l = 3.3 * rng.uniform(0.85, 1.1) * (1 - 0.08 * piso)
        sub = (1.05, 0.62, 0.22)[piso] + rng.uniform(-0.1, 0.1); cae = (0.95, 0.85, 0.75)[piso] + rng.uniform(-0.08, 0.1)
        p = arco(top + np.array([math.cos(a) * 0.1, math.sin(a) * 0.1, -0.05]), a, l, sub, cae, seg + 1, rng.uniform(-0.25, 0.25))
        u = np.linspace(0, 1, seg + 1); w = (0.46, 0.5, 0.58)[lod] * np.sin(np.clip(u * 0.93 + 0.09, 0, 1) * math.pi) ** 0.6
        v, f, tt = g_cinta(p, w + 0.012, 0.55)
        c = np.array([0.5, 0.6, 0.42])[None, :] * (1 - tt[:, None]) + np.array([1.12, 1.15, 0.78])[None, :] * tt[:, None]
        c[1::3] *= 0.6
        if lod == 0: c *= np.repeat(np.where(np.arange(seg + 1) % 2 == 0, 1.0, 0.72), 3)[:, None]     # bandas: sugieren los foliolos
        H.mas(v, f, c * rng.uniform(0.86, 1.12), 0.55 + 0.45 * tt)
    for i in range((3, 2, 0)[lod]):     # frondas secas, pegadas al tronco
        rng = azar(s * 71 + i); a = rng.uniform(0, PI2); p = arco(top + np.array([math.cos(a) * 0.12, math.sin(a) * 0.12, -0.25]), a, 2.2 * rng.uniform(0.8, 1.1), -0.25, 0.75, (4, 3, 2)[lod] + 1)
        u = np.linspace(0, 1, len(p)); v, f, tt = g_cinta(p, 0.34 * np.sin(np.clip(u * 0.9 + 0.1, 0, 1) * math.pi) ** 0.6 + 0.01, 0.5)
        S.mas(v, f, mezcla('#6e5a38', '#a08552', tt) * rng.uniform(0.8, 1.1), 0.5 + 0.4 * tt)
    hojas = H.malla('hoja', 'frondas'); inflar(hojas, [tuple(top + np.array([0, 0, -1.2]))], 0.7); dos_caras(hojas); hojas['dq_afilado'] = 1
    secas = S.malla('liso', 'secas')
    if secas is not None: inflar(secas, [tuple(top + np.array([0, 0, -0.5]))], 0.6); dos_caras(secas); secas['dq_afilado'] = 1
    C = Lote()
    for i in range((4, 3, 0)[lod]):
        a = a0 + 2.2 + i * 1.5; c = top + np.array([math.cos(a) * 0.24, math.sin(a) * 0.24, -0.36 - 0.06 * (i % 2)]); r = 0.17
        v, f, ix = g_torno([(0, -r), (r * 0.8, -r * 0.6), (r, 0), (r * 0.8, r * 0.6), (0, r)], (5, 4, 4)[lod], c, (0.1, 0.1, 1))
        C.mas(v, f, np.array([hexlin('#4a3b24') * k for k in (0.6, 0.8, 1.0, 1.15, 1.2)])[ix], 0.5)
    cocos = C.malla('liso', 'cocos', suave=60)
    return [tr, hojas, secas, cocos]


# ── arbol magico ──
def _magico(lod, s=1, alto=6.6, abrir=1.0):
    """Arbol arcano: tronco palido retorcido en espiral, tres brazos y copas en nube que toman el color de la zona;
    de las ramas cuelgan frutos de eter que brillan."""
    rng = azar(s); a0 = rng.uniform(0, PI2)
    an = (9, 5, 3)[lod]; lados = (8, 5, 3)[lod]
    eje = curva([(0, 0, -0.7), (0.12 * math.cos(a0), 0.12 * math.sin(a0), 1.3), (-0.2 * math.cos(a0 + 1), -0.2 * math.sin(a0 + 1), 2.6), (0.1, 0.05, 3.7)], an)
    t = np.linspace(0, 1, an); rad = 0.3 * (1 - 0.5 * t) + 0.3 * np.exp(-t * 7)
    tr = tubo(eje, rad, lados, 'tronco', 'madera', '#5a4a66', punta=False, perfil=(lambda t, a: 1 + 0.16 * math.cos(a * 3)) if lod < 2 else None, giro=3.4)
    partes = [tr]; puntas = []
    nb = 3
    for i in range(nb):
        a = a0 + PI2 * i / nb + rng.uniform(-0.3, 0.3); l = 2.3 * abrir * rng.uniform(0.85, 1.15); b = eje[-1] - np.array([0, 0, 0.25 + 0.3 * i])
        p = arco(b, a, l, 1.0 + 0.25 * rng.uniform(-1, 1), 0.38, (6, 4, 3)[lod], rng.uniform(-0.5, 0.5))
        partes.append(tubo(p, np.linspace(0.17, 0.05, len(p)), (6, 5, 3)[lod], 'rama', 'madera', '#5a4a66', punta=True))
        puntas.append(p[-1])
    if lod == 0:
        for i in range(4):   # raices
            a = a0 + PI2 * i / 4 + rng.uniform(-0.3, 0.3); p = arco((math.cos(a) * 0.2, math.sin(a) * 0.2, 0.42), a, 1.25 * rng.uniform(0.8, 1.2), -0.25, 0.42, 4)
            partes.append(tubo(p, np.linspace(0.16, 0.04, 4), 5, 'raiz', 'madera', '#5a4a66', punta=True))
    madera = unir(partes)
    P = pos(madera); z = np.clip(P[:, 2] / alto, 0, 1)
    C = np.tile(hexlin('#5d4c68'), (len(P), 1)) * (0.75 + 0.5 * z + 0.2 * ruido(P * np.array([3.0, 3.0, 0.5]), 1.0, s))[:, None]
    k = (np.clip(ruido_fbm(P, 1.6, s + 4, 2) * 1.8, 0, 1) * 0.45)[:, None]; C = C * (1 - k) + hexlin('#9c93a8') * k
    poner_color(madera, C)
    manchar(madera, '#2c2433', lambda P, N: 0.9 - P[:, 2] / 0.9, 0.7, 2.0, s + 2, 0.3)
    desgastar(madera, 0.3, 0.3)
    poner_viento(madera, np.clip((P[:, 2] - 1.5) / alto, 0, 1) * 0.6)
    marcar(madera, 'liso'); suavizar(madera, 60)
    cen = [tuple(p + np.array([0, 0, 0.35])) for p in puntas] + [tuple(eje[-1] + np.array([0, 0, 1.25]))]
    bolas = []; rng = azar(s + 100)
    for j, c in enumerate(cen):
        R = (1.25 if j == len(cen) - 1 else 1.05) * rng.uniform(0.9, 1.1)
        bolas.append((c[0], c[1], c[2], R * 1.15, R * 1.15, R * 0.62))
        for q in range(3):
            a = rng.uniform(0, PI2); bolas.append((c[0] + math.cos(a) * R * 0.75, c[1] + math.sin(a) * R * 0.75, c[2] + rng.uniform(-0.2, 0.3), R * 0.6, R * 0.6, R * 0.42))
    copa = masa(bolas, (0.24, 0.3, 0.42)[lod], (430, 150, 46)[lod], 0.14, 1.2, s, 'hoja', 0.7)
    zc = np.array([c[2] for c in cen]); Pc = pos(copa); N = normales(copa)
    luz = np.clip(0.52 + 0.55 * N[:, 2] + 0.22 * (Pc[:, 2] - zc.min()) / 2.0, 0.3, 1.35)
    poner_color(copa, np.c_[luz * 1.02, luz * 0.94, luz * 1.06] * (1 + 0.16 * ruido_fbm(Pc, 1.4, s + 8, 2))[:, None])
    res = [madera, copa]
    if lod == 0: res.append(hojas_sueltas(copa, 26, 0.4, s + 5, 0.06, (1.2, 1.1, 1.25), centros=cen))
    F = Lote(); nf = (9, 5, 3)[lod]
    for i in range(nf):     # frutos de eter colgando bajo las copas
        rng = azar(s * 37 + i); c = np.array(cen[i % len(cen)]); a = rng.uniform(0, PI2); r = rng.uniform(0.3, 0.95)
        q = c + np.array([math.cos(a) * r, math.sin(a) * r, -0.62 - rng.uniform(0, 0.55)]); R = 0.1 * rng.uniform(0.8, 1.3) * (1.0, 1.25, 1.7)[lod]
        v, f, ix = g_torno([(0, -R * 1.5), (R, 0), (0, R * 1.2)], (5, 4, 3)[lod], q, (0, 0, 1))
        F.mas(v, f, np.array([hexlin('#f3c8ff'), hexlin('#c05ae8'), hexlin('#7a2fb0')])[ix], 0.9)
    fr = F.malla('emisivo', 'frutos', suave=70)
    res.append(fr)
    return res


# ═══════════ REGISTRO ═══════════
T_ROCA = (350, 120, 40)
Z_GRIS = ['amanecer', 'castillo', 'abismo', 'pueblo', 'selva', 'noche']     # tambien las zonas que hoy no siembran rocas

# Granito gris con liquenes y musgo (zonas templadas). El material pone encima el musgo de la zona.
@modelo('roca_penasco', sustituye={'flora': 'roca', 'zonas': Z_GRIS, 'tam': 2.9, 'modo': 'a'}, tris=T_ROCA)
def roca_penasco(lod): return _penasco(11, 'gris', T_ROCA[lod])

@modelo('roca_cantos', sustituye={'flora': 'roca', 'zonas': Z_GRIS, 'tam': 2.6, 'modo': 'a', 'lejos': 'roca_penasco'}, tris=T_ROCA)
def roca_cantos(lod): return _cantos(23, 'gris', T_ROCA[lod])

@modelo('roca_losa', sustituye={'flora': 'roca', 'zonas': Z_GRIS, 'tam': 2.8, 'modo': 'a', 'lejos': 'roca_penasco'}, tris=T_ROCA)
def roca_losa(lod): return _losa(31, 'gris', T_ROCA[lod], (0.27, 0.5))

@modelo('roca_aguja', sustituye={'flora': 'roca', 'zonas': Z_GRIS, 'tam': 2.8, 'lejos': 'roca_penasco'}, tris=T_ROCA)
def roca_aguja(lod): return _aguja(47, 'gris', T_ROCA[lod])

@modelo('roca_monton', sustituye={'flora': 'roca', 'zonas': Z_GRIS, 'tam': 2.7, 'modo': 'a', 'lejos': 'roca_penasco'}, tris=T_ROCA)
def roca_monton(lod): return _monton(53, 'gris', T_ROCA[lod])

# Arenisca en estratos, con arena posada (desierto).
@modelo('arenisca_losa', sustituye={'flora': 'roca', 'zonas': ['desierto'], 'tam': 2.9, 'modo': 'a'}, tris=T_ROCA)
def arenisca_losa(lod): return _losa(61, 'arenisca', T_ROCA[lod], (0.27, 0.85), 5, 0.12)


@modelo('arenisca_aguja', sustituye={'flora': 'roca', 'zonas': ['desierto'], 'tam': 2.9, 'lejos': 'arenisca_losa'}, tris=T_ROCA)
def arenisca_aguja(lod): return _aguja(71, 'arenisca', T_ROCA[lod], (0.34, 0.85))

# Granito oscuro con nieve encima (cumbres).
@modelo('nevada_penasco', sustituye={'flora': 'roca', 'zonas': ['cumbres'], 'tam': 2.9, 'modo': 'a'}, tris=T_ROCA)
def nevada_penasco(lod): return _penasco(79, 'nevada', T_ROCA[lod])

@modelo('nevada_aguja', sustituye={'flora': 'roca', 'zonas': ['cumbres'], 'tam': 2.9, 'lejos': 'nevada_penasco'}, tris=T_ROCA)
def nevada_aguja(lod): return _aguja(83, 'nevada', T_ROCA[lod])


# Pizarra en lajas (tormenta).
@modelo('pizarra_lajas', sustituye={'flora': 'roca', 'zonas': ['tormenta'], 'tam': 2.8, 'modo': 'a'}, tris=T_ROCA)
def pizarra_lajas(lod): return _lajas(97, 'pizarra', T_ROCA[lod])

@modelo('pizarra_penasco', sustituye={'flora': 'roca', 'zonas': ['tormenta'], 'tam': 2.8, 'modo': 'a', 'lejos': 'pizarra_lajas'}, tris=T_ROCA)
def pizarra_penasco(lod): return _penasco(101, 'pizarra', T_ROCA[lod], (0.16, 0.6))


# Basalto (cavernas): columnas, peñasco con cristales incrustados y cantos.
@modelo('basalto_columnas', sustituye={'flora': 'roca', 'zonas': ['cavernas', 'acantilados'], 'tam': 2.7, 'modo': 'a'}, tris=T_ROCA)
def basalto_columnas(lod): return _columnas(107, 'basalto', T_ROCA[lod])

@modelo('basalto_penasco', sustituye={'flora': 'roca', 'zonas': ['cavernas', 'acantilados'], 'tam': 2.8, 'modo': 'a', 'lejos': 'basalto_columnas'}, tris=T_ROCA)
def basalto_penasco(lod):
    c = cristales([((0.55, -0.5, 0.75), (0.5, -0.6, 1), 0.7, 0.1), ((0.75, -0.3, 0.6), (1, -0.2, 0.7), 0.5, 0.08), ((-0.6, 0.3, 0.9), (-0.6, 0.2, 1), 0.6, 0.09), ((0.4, -0.7, 0.55), (0.3, -1, 0.5), 0.42, 0.07)][:(4, 3, 1)[lod]], AGUA, 5, 4 if lod < 2 else 3)
    return _penasco(109, 'basalto', T_ROCA[lod], None, [c])


# Pilares del castillo.
T_PILAR = (800, 300, 90)
@modelo('menhir_runas', sustituye={'flora': 'pilar', 'tam': 5.3}, tris=T_PILAR)
def menhir_runas(lod): return _menhir(lod)

@modelo('columna_rota', sustituye={'flora': 'pilar', 'tam': 4.3, 'lejos': 'menhir_runas'}, tris=T_PILAR)
def columna_rota(lod): return _columna(lod)

@modelo('obelisco_viejo', sustituye={'flora': 'pilar', 'tam': 5.2, 'lejos': 'menhir_runas'}, tris=T_PILAR)
def obelisco_viejo(lod): return _obelisco(lod)

# Cristales (a su tamaño real: como la figura de antes, ~3,6 m el mayor).
T_CRISTAL = (420, 160, 48)
@modelo('cristal_agua_a', sustituye={'flora': 'cristal', 'zonas': ['cavernas']}, tris=T_CRISTAL, ao=0.5)
def cristal_agua_a(lod): return _racimo(3, AGUA, lod, 'aguja')

@modelo('cristal_agua_b', sustituye={'flora': 'cristal', 'zonas': ['cavernas'], 'lejos': 'cristal_agua_a'}, tris=T_CRISTAL, ao=0.5)
def cristal_agua_b(lod): return _racimo(8, AGUA, lod, 'abanico')

@modelo('cristal_arcano_a', sustituye={'flora': 'cristal', 'zonas': ['acantilados']}, tris=T_CRISTAL, ao=0.5)
def cristal_arcano_a(lod): return _racimo(13, ARCANO, lod, 'aguja')

@modelo('cristal_arcano_b', sustituye={'flora': 'cristal', 'zonas': ['acantilados'], 'lejos': 'cristal_arcano_a'}, tris=T_CRISTAL, ao=0.5)
def cristal_arcano_b(lod): return _racimo(21, ARCANO, lod, 'abanico')

# Arbol magico.
@modelo('arcano_a', sustituye={'flora': 'magico', 'tam': 6.6}, tris=(1100, 340, 110))
def arcano_a(lod): return _magico(lod, 4)

@modelo('arcano_b', sustituye={'flora': 'magico', 'tam': 6.0, 'lejos': 'arcano_a'}, tris=(1100, 340, 110))
def arcano_b(lod): return _magico(lod, 12, abrir=1.2)

# Setas grandes.
T_SETA = (520, 210, 90)
@modelo('seta_parda', sustituye={'flora': 'hongo', 'tam': 1.35}, tris=T_SETA)
def seta_parda(lod): return _setas(lod, 2, [(0, 0, 1.05, 0.52), (0.42, -0.18, 0.62, 0.34), (-0.3, 0.3, 0.4, 0.24)], '#6e3a26', '#b58a5c', '#d8c9a6')

@modelo('seta_luna', sustituye={'flora': 'hongo', 'tam': 1.1, 'lejos': 'seta_parda'}, tris=T_SETA)
def seta_luna(lod): return _setas(lod, 6, [(0, 0, 0.9, 0.4), (-0.36, -0.2, 0.58, 0.28), (0.3, 0.32, 0.36, 0.2)], '#27504c', '#3f8f84', '#2fb89c', brillo='#2fc9a6')

@modelo('seta_ocre', sustituye={'flora': 'hongo', 'tam': 0.95, 'lejos': 'seta_parda'}, tris=T_SETA)
def seta_ocre(lod): return _setas(lod, 9, [(0.3, 0.14, 0.86, 0.26), (0, 0, 0.66, 0.3), (-0.24, 0.28, 0.45, 0.22)], '#9a7634', '#d2bb82', '#e2d6b4', lados=(6, 5, 4))

# Flores.
T_FLOR = (450, 200, 68)
@modelo('flor_ambar', sustituye={'flora': 'flor', 'tam': 0.85}, tris=T_FLOR, ao=0.5)
def flor_ambar(lod): return _margaritas(lod, 1)

@modelo('flor_tarwi', sustituye={'flora': 'flor', 'tam': 0.9, 'lejos': 'flor_ambar'}, tris=T_FLOR, ao=0.5)
def flor_tarwi(lod): return _tarwi(lod, 2)

@modelo('flor_cantuta', sustituye={'flora': 'flor', 'tam': 0.85, 'lejos': 'flor_ambar'}, tris=T_FLOR, ao=0.5)
def flor_cantuta(lod): return _cantuta(lod, 3)


# Matas.
T_MATA = (380, 130, 40)
@modelo('mata_ichu', sustituye={'flora': 'hierba', 'tam': 0.9}, tris=T_MATA, ao=0.6)
def mata_ichu(lod): return _ichu(lod, 1)

@modelo('mata_helecho', sustituye={'flora': 'hierba', 'tam': 0.75, 'lejos': 'mata_ichu'}, tris=T_MATA, ao=0.6)
def mata_helecho(lod): return _helecho(lod, 2)

@modelo('mata_ancha', sustituye={'flora': 'hierba', 'tam': 0.8, 'lejos': 'mata_ichu'}, tris=T_MATA, ao=0.6)
def mata_ancha(lod): return _llanten(lod, 3)

# Palmeras.
T_PALMA = (1300, 480, 140)
@modelo('palma_a', sustituye={'flora': 'palma', 'tam': 8}, tris=T_PALMA)
def palma_a(lod): return _palma(lod, 1)

@modelo('palma_b', sustituye={'flora': 'palma', 'tam': 7, 'lejos': 'palma_a'}, tris=T_PALMA)
def palma_b(lod): return _palma(lod, 5, alto=6.6, curva_=2.3, n_hojas=9)
