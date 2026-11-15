# ═══════════════════════════════════════════════════════
# DUENDE QUEST — familia «monstruos»: los bichos que seguían con el modelo viejo de primitivas
#
# Cada monstruo sale en PIEZAS (cuerpo, cabeza, mandíbula, pata, cola...) y cada pieza es un modelo del paquete
# (`bes_<bicho>_<pieza>`). mundo/js/bestias.js monta el mismo rig de pivotes que el arquetipo viejo de modelos.js
# y cuelga cada pieza de su pivote: la animación por código no cambia. Si el paquete no llega, sale el modelo viejo.
#
# IMPORTANTE: aquí todo se escribe en COORDENADAS DEL JUEGO, relativas al pivote de la pieza:
#   x = derecha del bicho, y = arriba, z = hacia delante (el bicho mira a +z). Unidades: las «de diseño» de
#   modelos.js (el rig se escala luego al alto del monstruo). g2b() lo pasa a Blender (Z arriba, frente −Y).
# Marcas: 'hoja' = piel que toma el TINTE del monstruo (el color pintado es un multiplicador: (1,1,1) = el tinte),
#   'emisivo' = brilla (ojos, brasas, runas), 'liso' = su color tal cual.
# Foto: node tools/blender/construir.mjs --foto monstruos bes_arana_cuerpo salida.png --tinte=#c0a830
# ═══════════════════════════════════════════════════════
import math
import numpy as np
from dq_lib import *

TIN = (1.0, 1.0, 1.0)   # multiplicador neutro del tinte


# ── coordenadas del juego ↔ Blender ──
def g2b(p): return (float(p[0]), float(-p[2]), float(p[1]))
def e2b(s): return (float(s[0]), float(s[2]), float(s[1]))          # radios/escala por eje


def pg(obj):
    P = pos(obj); return np.stack([P[:, 0], P[:, 2], -P[:, 1]], 1)


def ng(obj):
    N = normales(obj); return np.stack([N[:, 0], N[:, 2], -N[:, 1]], 1)


def color_g(obj, fn):
    """fn(P, N, C) en coordenadas del juego → colores lineales."""
    return poner_color(obj, fn(pg(obj), ng(obj), color_de(obj)))


def mezclar(C, color, k):
    k = np.clip(np.asarray(k, dtype=float), 0, 1)[:, None]
    return C * (1 - k) + (hexlin(color) if isinstance(color, str) else np.array(color, dtype=float)) * k


# ── piezas ──
def elip(c, r, sub=2, marca='liso', color='#888888', nombre='elip'):
    o = primitiva('esfera', nombre, marca, color, radio=1.0, subdiv=sub)
    return mover(o, g2b(c), (0, 0, 0), e2b(r))


def tubo_g(puntos, radios, lados=6, marca='liso', color='#555555', punta=True, n=None, base=False, perfil=None):
    P = np.asarray(puntos, dtype=float)
    if n: P = curva(P, n)
    if n and not np.isscalar(radios) and len(radios) != len(P):
        R = np.asarray(radios, dtype=float); R = np.interp(np.linspace(0, 1, len(P)), np.linspace(0, 1, len(R)), R)
    else: R = radios
    return tubo([g2b(p) for p in P], R, lados, marca=marca, color=color, punta=punta, tapa_base=base, perfil=perfil)


def cono_g(base, punta, r, lados=5, marca='liso', color='#e8dcc0'):
    """Púa, diente o garra: de `base` a `punta` (coordenadas del juego)."""
    return tubo_g([base, (np.array(base) * 0.5 + np.array(punta) * 0.5), punta], [r, r * 0.55, r * 0.12], lados, marca, color, punta=True)


def masa_g(bolas, voxel=0.05, tris=600, ruido_f=0.0, ruido_e=6.0, semilla=1, marca='hoja', color=TIN):
    """Volumen orgánico fundido. bolas: (x, y, z, r) o (x, y, z, rx, ry, rz) en coordenadas del juego."""
    objs = []
    for b in bolas:
        r = (b[3], b[3], b[3]) if len(b) == 4 else (b[3], b[4], b[5])
        objs.append(elip(b[:3], r, 2, marca, '#808080'))
    o = unir(objs)
    remallar(o, voxel)
    if ruido_f: desplazar(o, ruido_f, ruido_e, semilla, 2)
    decimar(o, tris)
    o['dq_afilado'] = 1; o.data.shade_smooth()
    marcar(o, marca)
    pintar(o, color)
    return o


def sim_x(fn):
    """Llama fn(s) para s = 1 y -1 y devuelve la lista (piezas simétricas)."""
    return [fn(1), fn(-1)]


def acabar(o, angulo=60, variacion=0.12, semilla=3, cantos=0.18):
    if variacion: variar(o, variacion, 5.0, semilla)
    if cantos: desgastar(o, cantos, cantos)
    return suavizar(o, angulo)


PIEZA = dict(ao=0.6, ao_dist=0.35, suelo=False, lods='decimar')


# ═══════════ ARAÑA DE CENIZA (arana · Reina Araña) ═══════════
# Rig (bestias.js): cuerpo en la raíz; cabeza en (0, 0.34, 0.3) del cuerpo; colmillos en (±0.05, −0.08, 0.08) de
# la cabeza; 8 patas en (±0.16, 0.32, 0.22 − i·0.1) de la raíz, giradas en Y (la pieza apunta a +x).
QUITINA = '#2c2624'
CENIZA = '#5d5651'


@modelo('bes_arana_cuerpo', tris=(1000, 420, 140), **PIEZA)
def arana_cuerpo(lod):
    # Abdomen: bulbo segmentado con la piel teñida, chevrones oscuros y grietas de brasa.
    ab = elip((0, 0.44, -0.44), (0.40, 0.33, 0.48), 3, 'hoja', TIN)
    deformar(ab, lambda P: P * np.c_[1 + 0.035 * np.sin(-P[:, 1] * 38), np.ones(len(P)), 1 + 0.035 * np.sin(-P[:, 1] * 38)])   # anillos
    desplazar(ab, 0.012, 9.0, semilla=2)
    def piel_ab(P, N, C):
        z = P[:, 2] + 0.44; x = np.abs(P[:, 0]); y = P[:, 1] - 0.44
        chev = np.clip(1 - np.abs(((z * 4.2 + x * 3.0) % 1.0) - 0.5) * 7, 0, 1) * (y > 0.05) * (x < 0.26)
        k = 0.62 + 0.38 * np.clip(y / 0.33 + 0.4, 0, 1)            # panza más oscura
        M = np.ones((len(P), 3)) * k[:, None]
        M = mezclar(M, (0.16, 0.13, 0.12), chev * 0.9)           # chevrones casi negros
        M = mezclar(M, (1.25, 1.15, 0.95), np.clip(1 - x / 0.05, 0, 1) * (y > 0.1) * 0.5)   # raya clara del lomo
        return M
    color_g(ab, piel_ab)
    # Cefalotórax: placa de quitina con canto gastado.
    ce = elip((0, 0.33, 0.12), (0.25, 0.17, 0.28), 2, 'liso', QUITINA)
    deformar(ce, lambda P: P + np.c_[np.zeros(len(P)), np.zeros(len(P)), 0.05 * np.clip((P[:, 2] - 0.33) / 0.17, 0, 1)])   # lomo alzado
    color_g(ce, lambda P, N, C: mezclar(C, CENIZA, np.clip(N[:, 1], 0, 1) * 0.6))
    ped = elip((0, 0.38, -0.08), (0.11, 0.09, 0.12), 1, 'liso', QUITINA)                     # pedicelo
    piezas = [ab, ce, ped]
    # Brasas: pústulas que brillan entre los anillos del abdomen.
    rng = azar(11)
    for i in range(9 if lod == 0 else 5):
        a = rng.uniform(-2.4, 2.4); e = rng.uniform(-0.2, 0.75)
        c = (0.40 * math.sin(a) * math.cos(e), 0.44 + 0.33 * math.sin(e), -0.44 + 0.48 * math.cos(a) * math.cos(e))
        piezas.append(elip(c, (0.035, 0.03, 0.035), 1, 'emisivo', '#ff6a1c'))
    # Cerdas negras del lomo e hileras de la punta.
    for i in range(10):
        a = rng.uniform(-2.8, 2.8); e = rng.uniform(0.15, 0.9)
        n = np.array([math.sin(a) * math.cos(e), math.sin(e), math.cos(a) * math.cos(e)])
        b = np.array((0, 0.44, -0.44)) + n * np.array((0.39, 0.32, 0.47))
        piezas.append(cono_g(b, b + n * 0.09 + (0, 0.02, -0.03), 0.014, 4, 'liso', '#1a1615'))
    for x in (-0.05, 0.05):
        piezas.append(cono_g((x, 0.4, -0.88), (x * 1.6, 0.36, -0.98), 0.03, 5, 'liso', CENIZA))
    o = unir(piezas)
    return acabar(o, 55, 0.12, 4, 0.15)


@modelo('bes_arana_cabeza', tris=(320, 140, 50), **PIEZA)
def arana_cabeza(lod):
    cap = elip((0, 0.0, 0.03), (0.16, 0.11, 0.13), 2, 'liso', QUITINA)
    color_g(cap, lambda P, N, C: mezclar(C, CENIZA, np.clip(N[:, 1], 0, 1) * 0.5))
    p = [cap]
    for s in (1, -1):
        p.append(elip((s * 0.065, 0.06, 0.11), (0.045, 0.045, 0.035), 1, 'emisivo', '#ff3524'))
        p.append(elip((s * 0.13, 0.035, 0.07), (0.03, 0.03, 0.025), 1, 'emisivo', '#ff3524'))
        p.append(elip((s * 0.04, 0.1, 0.06), (0.02, 0.02, 0.018), 1, 'emisivo', '#ff8a3a'))
        # Pedipalpos: bracitos que palpan delante de los colmillos.
        p.append(tubo_g([(s * 0.09, -0.04, 0.1), (s * 0.13, -0.05, 0.18), (s * 0.11, -0.13, 0.22)], [0.022, 0.018, 0.01], 5, 'liso', '#3a322e'))
    return acabar(unir(p), 60, 0.08, 6, 0.12)


@modelo('bes_arana_colmillo', tris=(60, 30, 12), **PIEZA)
def arana_colmillo(lod):
    base = elip((0, -0.02, 0.0), (0.035, 0.05, 0.035), 1, 'liso', '#3a2a26')
    u = tubo_g([(0, -0.04, 0.0), (0, -0.09, 0.03), (0, -0.13, 0.01)], [0.022, 0.014, 0.004], 5, 'liso', '#d9c9a8')
    return acabar(unir([base, u]), 60, 0, 1, 0)


@modelo('bes_arana_pata', tris=(130, 60, 20), **PIEZA)
def arana_pata(lod):
    pts = [(0, 0, 0), (0.12, 0.12, 0), (0.27, 0.21, 0), (0.36, 0.2, 0), (0.46, 0.0, 0), (0.55, -0.32, 0)]
    t = tubo_g(pts, [0.05, 0.045, 0.04, 0.036, 0.026, 0.01], 5, 'liso', QUITINA, n=10)
    def bandas(P, N, C):
        d = np.hypot(P[:, 0], P[:, 1])
        b = (np.abs(d - 0.2) < 0.05) | (np.abs(d - 0.42) < 0.03)
        return mezclar(C, '#7a6f66', np.clip(N[:, 1], 0, 1) * 0.45) * np.where(b, 1.0, 1.0)[:, None]
    color_g(t, bandas)
    rod = elip((0.355, 0.205, 0), (0.05, 0.045, 0.045), 1, 'hoja', (0.8, 0.8, 0.8))   # rodilla con el color del bicho
    return acabar(unir([t, rod]), 70, 0.1, 7, 0.2)
