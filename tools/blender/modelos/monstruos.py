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


# ── ayudas de bestias ──
def garras(punta, n=3, abre=0.05, largo=0.06, r=0.012, color='#d8ccb0', hacia=(0, -0.02, 1)):
    """n garras que salen de `punta` hacia delante (abiertas en abanico)."""
    out = []; h = np.array(hacia, dtype=float); h /= np.linalg.norm(h)
    for i in range(n):
        x = (i - (n - 1) / 2) * abre
        b = np.array(punta) + (x, 0, 0)
        out.append(cono_g(b, b + h * largo + (x * 0.4, -0.015, 0), r, 4, 'liso', color))
    return out


def pata_bestia(largo, grosor, del_=True, marca='hoja', color=TIN, pie=(0.07, 0.035, 0.1), n_garras=3, color_garra='#d8ccb0', lados=6):
    """Pata que cuelga del pivote (origen) hasta el suelo (y = −largo): muslo, codo/corvejón, pie y garras."""
    L = largo; g = grosor
    if del_: pts = [(0, 0.02, 0), (0, -L * 0.45, -L * 0.08), (0, -L * 0.8, 0.0), (0, -L + pie[1] * 0.6, pie[2] * 0.3)]
    else: pts = [(0, 0.02, 0), (0, -L * 0.4, L * 0.12), (0, -L * 0.72, -L * 0.06), (0, -L + pie[1] * 0.6, pie[2] * 0.3)]
    t = tubo_g(pts, [g * 1.5, g * 1.1, g * 0.85, g * 0.8], lados, marca, color, n=9)
    m = elip((0, -L * 0.1, 0), (g * 1.6, L * 0.32, g * 1.8), 2, marca, color)          # muslo
    p = elip((0, -L + pie[1] * 0.5, pie[2] * 0.35), pie, 1, marca, tuple(np.array(color) * 0.8) if not isinstance(color, str) else color)
    out = [t, m, p]
    if n_garras: out += garras((0, -L + pie[1] * 0.4, pie[2] * 0.35 + pie[2] * 0.8), n_garras, pie[0] * 0.6, pie[2] * 0.6, g * 0.35, color_garra)
    return out


# ═══════════ LAGARTO (lagarto) ═══════════
# Rig: cuerpo (0, 0.32, 0); cabeza (0, 0.06, 0.55) del cuerpo; mandíbula (0, −0.06, 0.05) de la cabeza;
# cola (0, 0, −0.55) del cuerpo; patas (±0.24, 0.32, ±0.3) de la raíz, abiertas ±0.5 en Z, largo 0.3.
def bandas_lomo(P, N, C, z0=0.0, frec=5.5, base=1.0, oscuro=0.3, vientre=1.9):
    """Piel teñida: bandas oscuras en el lomo y vientre claro (multiplicadores del tinte)."""
    y = N[:, 1]
    banda = np.clip(np.sin((P[:, 2] - z0) * frec * 2 * math.pi) * 3 - 0.8, 0, 1) * np.clip(y * 2.5 + 0.3, 0, 1)
    M = np.ones((len(P), 3)) * base
    M = mezclar(M, (oscuro, oscuro * 0.9, oscuro), banda * 0.85)
    M = mezclar(M, (vientre, vientre * 1.05, vientre * 0.75), np.clip(-y * 1.6 - 0.2, 0, 1))
    return M


@modelo('bes_lagarto_cuerpo', tris=(760, 320, 110), **PIEZA)
def lagarto_cuerpo(lod):
    o = masa_g([(0, 0.0, 0.32, 0.19, 0.14, 0.24), (0, 0.02, -0.02, 0.27, 0.17, 0.3), (0, 0.0, -0.38, 0.19, 0.13, 0.24),
                (0, 0.05, 0.52, 0.12, 0.1, 0.12), (0.2, -0.02, 0.28, 0.08), (-0.2, -0.02, 0.28, 0.08), (0.19, -0.02, -0.3, 0.08), (-0.19, -0.02, -0.3, 0.08)],
               voxel=0.035, tris=600, ruido_f=0.008, ruido_e=14, semilla=3)
    color_g(o, lambda P, N, C: bandas_lomo(P, N, C, 0.0, 2.2))
    piezas = [o]
    # Cresta de placas óseas a lo largo del espinazo.
    for i, z in enumerate(np.linspace(0.45, -0.55, 9)):
        h = 0.05 + 0.06 * math.sin(math.pi * (i + 1) / 10)
        y = 0.17 - 0.05 * abs(z) ** 1.5
        piezas.append(cono_g((0, y - 0.02, z), (0, y + h, z - 0.05), 0.035, 4, 'hoja', (0.4, 0.33, 0.3)))
    return acabar(unir(piezas), 55, 0.12, 5, 0.18)


@modelo('bes_lagarto_cabeza', tris=(380, 160, 60), **PIEZA)
def lagarto_cabeza(lod):
    cr = masa_g([(0, 0.0, 0.06, 0.14, 0.1, 0.13), (0, -0.01, 0.2, 0.11, 0.075, 0.13), (0, -0.02, 0.32, 0.075, 0.055, 0.06)], voxel=0.022, tris=260, semilla=4)
    color_g(cr, lambda P, N, C: mezclar(np.ones((len(P), 3)), (1.8, 1.8, 1.4), np.clip(-N[:, 1] * 1.5 - 0.3, 0, 1)) * (1 - 0.35 * np.clip(N[:, 1], 0, 1))[:, None])
    p = [cr]
    for s in (1, -1):
        p.append(elip((s * 0.095, 0.05, 0.17), (0.04, 0.038, 0.038), 1, 'emisivo', '#ffd040'))
        p.append(elip((s * 0.088, 0.075, 0.15), (0.05, 0.022, 0.06), 1, 'hoja', (0.55, 0.5, 0.5)))          # ceja
        p.append(cono_g((s * 0.08, 0.07, 0.0), (s * 0.15, 0.13, -0.17), 0.03, 5, 'liso', '#d8ccb0'))        # cuerno
        p.append(cono_g((s * 0.11, 0.0, 0.05), (s * 0.19, -0.02, -0.06), 0.022, 4, 'hoja', (0.6, 0.55, 0.55)))   # púa de la mejilla
        for z in (0.24, 0.3):
            p.append(cono_g((s * 0.055, -0.045, z), (s * 0.055, -0.08, z + 0.005), 0.012, 4, 'liso', '#efe6cf'))
    return acabar(unir(p), 55, 0.08, 6, 0.15)


@modelo('bes_lagarto_mandibula', tris=(140, 60, 24), **PIEZA)
def lagarto_mandibula(lod):
    j = masa_g([(0, -0.02, 0.1, 0.1, 0.035, 0.12), (0, -0.02, 0.22, 0.07, 0.03, 0.08)], voxel=0.02, tris=100, semilla=5)
    color_g(j, lambda P, N, C: mezclar(np.ones((len(P), 3)) * 0.8, (1.7, 1.7, 1.3), np.clip(-N[:, 1], 0, 1)))
    p = [j, elip((0, 0.0, 0.15), (0.07, 0.012, 0.1), 1, 'liso', '#5a1424')]   # lengua y boca
    for s in (1, -1):
        for z in (0.2, 0.26):
            p.append(cono_g((s * 0.05, 0.0, z), (s * 0.05, 0.035, z), 0.011, 4, 'liso', '#efe6cf'))
    return acabar(unir(p), 60, 0.05, 2, 0)


@modelo('bes_lagarto_cola', tris=(240, 100, 36), **PIEZA)
def lagarto_cola(lod):
    t = tubo_g([(0, 0, 0.08), (0, -0.04, -0.26), (0.03, -0.09, -0.52), (0, -0.13, -0.76)], [0.13, 0.09, 0.05, 0.008], 7, 'hoja', TIN, n=12,
               perfil=lambda t, a: 1 - 0.18 * abs(math.cos(a)))
    color_g(t, lambda P, N, C: bandas_lomo(P, N, C, 0.0, 3.0))
    p = [t]
    for z in np.linspace(-0.05, -0.5, 5):
        y = 0.1 - 0.12 * (-z) - 0.06 * z * z
        p.append(cono_g((0, y - 0.02, z), (0, y + 0.06, z - 0.04), 0.025, 4, 'hoja', (0.4, 0.33, 0.3)))
    return acabar(unir(p), 55, 0.1, 7, 0.15)


@modelo('bes_lagarto_pata', tris=(170, 70, 26), **PIEZA)
def lagarto_pata(lod):
    return acabar(unir(pata_bestia(0.3, 0.05, True, 'hoja', (0.85, 0.85, 0.85), pie=(0.07, 0.03, 0.09), color_garra='#e0d4b8')), 60, 0.08, 8, 0.15)


# ═══════════ SERPIENTE (serpiente) ═══════════
# Rig: 7 segmentos (pivotes = la propia pieza, escalada por segmento) en la raíz; punta de la cola; cuello en
# (0, 0.12, 0.2) de la raíz; cabeza (grupo fijo) en (0, 0.5, 0.1) del cuello; mandíbula (0, −0.06, 0.02) de la cabeza.
def piel_serpiente(P, N, C, escala=1.0):
    x = np.abs(P[:, 0]) / escala; y = P[:, 1] / escala; z = P[:, 2] / escala
    rombo = np.abs(((z * 1.6) % 1.0) - 0.5) * 2 + x * 1.5           # 0 en el centro del rombo
    borde = np.clip(1 - np.abs(rombo - 0.75) * 7, 0, 1) * np.clip(y * 2.5, 0, 1)
    dentro = np.clip(1 - rombo * 1.6, 0, 1) * np.clip(y * 2.5, 0, 1)
    M = np.ones((len(P), 3))
    M = mezclar(M, (0.22, 0.2, 0.18), borde * 0.95)
    M = mezclar(M, (1.35, 1.3, 1.0), dentro * 0.6)
    M = mezclar(M, (2.4, 2.2, 0.9), np.clip(-y * 2.2 - 0.25, 0, 1))      # escamas del vientre, amarillas
    return M


@modelo('bes_serp_seg', tris=(150, 70, 28), **PIEZA)
def serp_seg(lod):
    o = elip((0, 0, 0), (1, 1, 1), 2, 'hoja', TIN)
    color_g(o, lambda P, N, C: piel_serpiente(P, N, C, 1.0))
    return acabar(o, 70, 0.1, 9, 0.1)


@modelo('bes_serp_cola', tris=(110, 50, 20), **PIEZA)
def serp_cola(lod):
    t = tubo_g([(0, 0, 0.04), (0, 0, -0.12), (0, 0.01, -0.2)], [0.05, 0.036, 0.024], 6, 'hoja', TIN, punta=False)
    color_g(t, lambda P, N, C: piel_serpiente(P * 8, N, C))
    p = [t]
    for i in range(3):   # cascabel de hueso
        z = -0.21 - i * 0.035
        p.append(elip((0, 0.01, z), (0.03 - i * 0.006, 0.022 - i * 0.004, 0.022), 1, 'liso', '#cdbb94'))
    return acabar(unir(p), 60, 0.08, 4, 0.2)


@modelo('bes_serp_cuello', tris=(420, 180, 60), **PIEZA)
def serp_cuello(lod):
    t = tubo_g([(0, -0.1, -0.06), (0, 0.12, -0.04), (0, 0.32, 0.02), (0, 0.48, 0.08)], [0.13, 0.12, 0.105, 0.095], 9, 'hoja', TIN, n=10, punta=False)
    color_g(t, lambda P, N, C: mezclar(np.ones((len(P), 3)), (2.4, 2.2, 0.9), np.clip(N[:, 2] * 2 - 0.3, 0, 1)))   # garganta clara delante
    # Capucha: lámina gruesa detrás del cuello, curvada hacia delante, con anteojos oscuros en el dorso.
    h = elip((0, 0.33, -0.02), (0.26, 0.2, 0.045), 3, 'hoja', TIN)
    deformar(h, lambda P: P - np.c_[np.zeros(len(P)), 1.2 * P[:, 0] ** 2, np.zeros(len(P))])   # bordes hacia delante (+z del juego = −y de Blender)
    def capucha(P, N, C):
        dx = np.abs(P[:, 0]) - 0.1; dy = P[:, 1] - 0.36
        d = np.hypot(dx, dy * 1.3)
        anillo = np.clip(1 - np.abs(d - 0.05) * 30, 0, 1) * (N[:, 2] < 0)
        M = mezclar(np.ones((len(P), 3)) * 0.9, (2.3, 2.1, 0.9), np.clip(N[:, 2] * 2, 0, 1) * 0.8)   # el frente, claro
        return mezclar(M, (0.15, 0.13, 0.12), anillo)
    color_g(h, capucha)
    return acabar(unir([t, h]), 60, 0.08, 10, 0.12)


@modelo('bes_serp_cabeza', tris=(340, 150, 56), **PIEZA)
def serp_cabeza(lod):
    cr = masa_g([(0, 0.0, 0.04, 0.13, 0.08, 0.12), (0, -0.005, 0.16, 0.095, 0.06, 0.1), (0.09, 0.0, 0.0, 0.06), (-0.09, 0.0, 0.0, 0.06)], voxel=0.018, tris=240, semilla=6)
    color_g(cr, lambda P, N, C: mezclar(piel_serpiente(P * 3, N, C), (2.4, 2.2, 0.9), np.clip(-N[:, 1] * 2 - 0.4, 0, 1)))
    p = [cr]
    for s in (1, -1):
        p.append(elip((s * 0.085, 0.035, 0.11), (0.032, 0.03, 0.03), 1, 'emisivo', '#ffd23a'))
        p.append(elip((s * 0.075, 0.06, 0.1), (0.045, 0.018, 0.06), 1, 'hoja', (0.35, 0.3, 0.3)))     # ceja de escama
        p.append(cono_g((s * 0.045, -0.04, 0.19), (s * 0.04, -0.1, 0.205), 0.014, 4, 'liso', '#f2ead6'))  # colmillo
        p.append(elip((s * 0.03, 0.012, 0.25), (0.008, 0.006, 0.006), 1, 'liso', '#160c0c'))           # narina
    return acabar(unir(p), 55, 0.06, 11, 0.15)


@modelo('bes_serp_mandibula', tris=(110, 50, 20), **PIEZA)
def serp_mandibula(lod):
    j = elip((0, -0.01, 0.1), (0.085, 0.022, 0.12), 2, 'hoja', (2.2, 2.0, 0.9))
    b = elip((0, 0.006, 0.1), (0.07, 0.01, 0.1), 1, 'liso', '#7a2034')
    return acabar(unir([j, b]), 60, 0.05, 2, 0)


# ═══════════ ZARIGÜEYA (zarigueya) ═══════════
# Rig: cuerpo (0, 0.38, 0); cabeza (0, 0.08, 0.42) del cuerpo; mandíbula (0, −0.06, 0.12) de la cabeza;
# cola (0, 0, −0.42) del cuerpo; patas (±0.17, 0.32, ±0.25) de la raíz, largo 0.3.
CARA_ZARI = '#cfc9b8'


@modelo('bes_zari_cuerpo', tris=(720, 300, 100), **PIEZA)
def zari_cuerpo(lod):
    o = masa_g([(0, 0.0, 0.0, 0.25, 0.22, 0.38), (0, 0.04, -0.22, 0.23, 0.21, 0.22), (0, -0.01, 0.28, 0.18, 0.17, 0.17)], voxel=0.03, tris=520, ruido_f=0.018, ruido_e=16, semilla=7)
    def pelo(P, N, C):
        M = np.ones((len(P), 3)) * (0.85 + 0.25 * ruido_fbm(P, 18, 3, 2))[:, None]
        M = mezclar(M, (0.45, 0.45, 0.5), np.clip(1 - np.abs(P[:, 0]) / 0.06, 0, 1) * np.clip(N[:, 1], 0, 1))   # raya del lomo
        M = mezclar(M, (2.6, 2.6, 2.2), np.clip(-N[:, 1] * 1.4 - 0.1, 0, 1) * 0.8)                              # panza clara
        return M
    color_g(o, pelo)
    p = [o]
    rng = azar(17)
    for i in range(22 if lod == 0 else 10):   # mechones de pelo erizado
        a = rng.uniform(-1.3, 1.3); z = rng.uniform(-0.4, 0.3)
        n = np.array([math.sin(a), math.cos(a), 0.0])
        b = np.array((0, 0.02, z)) + n * np.array((0.22, 0.2, 0))
        p.append(cono_g(b - n * 0.02, b + n * 0.07 + (0, 0.01, -0.07), 0.03, 3, 'hoja', (0.7, 0.7, 0.75)))
    return acabar(unir(p), 60, 0.1, 12, 0.12)


@modelo('bes_zari_cabeza', tris=(420, 180, 60), **PIEZA)
def zari_cabeza(lod):
    cr = masa_g([(0, 0.0, 0.04, 0.15, 0.13, 0.15), (0, -0.01, 0.18, 0.09, 0.08, 0.1), (0, -0.015, 0.29, 0.055, 0.05, 0.06)], voxel=0.02, tris=260, marca='liso', color=CARA_ZARI, semilla=8)
    color_g(cr, lambda P, N, C: mezclar(C, '#3a3330', np.clip(1 - np.hypot(np.abs(P[:, 0]) - 0.07, P[:, 1] - 0.05) / 0.06, 0, 1) * (P[:, 2] > 0.08)))   # antifaz
    p = [cr, elip((0, -0.005, 0.345), (0.032, 0.026, 0.024), 1, 'liso', '#d8828e')]
    for s in (1, -1):
        p.append(elip((s * 0.07, 0.05, 0.155), (0.028, 0.03, 0.022), 1, 'liso', '#0e0a0c'))
        p.append(elip((s * 0.072, 0.052, 0.172), (0.011, 0.012, 0.008), 1, 'emisivo', '#ff4a3a'))
        p.append(elip((s * 0.11, 0.13, -0.01), (0.065, 0.075, 0.018), 2, 'liso', '#c97f8c'))           # oreja rosa
        p.append(elip((s * 0.112, 0.13, -0.022), (0.075, 0.085, 0.012), 1, 'liso', '#2c2629'))          # su dorso oscuro
        p.append(cono_g((s * 0.03, -0.035, 0.27), (s * 0.03, -0.085, 0.285), 0.012, 4, 'liso', '#f3ecd8'))
    for i in range(4):   # bigotes
        s = 1 if i % 2 else -1
        p.append(cono_g((s * 0.04, -0.005, 0.28 - (i // 2) * 0.03), (s * 0.17, 0.01 - (i // 2) * 0.03, 0.27), 0.004, 3, 'liso', '#e8e2d2'))
    return acabar(unir(p), 55, 0.06, 13, 0.12)


@modelo('bes_zari_mandibula', tris=(110, 50, 20), **PIEZA)
def zari_mandibula(lod):
    j = elip((0, -0.02, 0.12), (0.07, 0.03, 0.13), 2, 'liso', CARA_ZARI)
    p = [j, elip((0, 0.0, 0.12), (0.05, 0.012, 0.09), 1, 'liso', '#a4505e')]
    for s in (1, -1): p.append(cono_g((s * 0.04, 0.0, 0.2), (s * 0.04, 0.045, 0.21), 0.011, 4, 'liso', '#f3ecd8'))
    return acabar(unir(p), 60, 0.04, 3, 0)


@modelo('bes_zari_cola', tris=(200, 90, 30), **PIEZA)
def zari_cola(lod):
    t = tubo_g([(0, 0, 0.04), (0, -0.08, -0.28), (0.05, -0.13, -0.52), (0.13, -0.06, -0.7), (0.16, 0.04, -0.72)], [0.05, 0.04, 0.03, 0.02, 0.012], 6, 'liso', '#d49aa2', n=16)
    color_g(t, lambda P, N, C: C * (0.78 + 0.22 * np.clip(np.sin(np.hypot(P[:, 1], P[:, 2]) * 70) * 2, 0, 1))[:, None])   # anillos
    return acabar(t, 70, 0.06, 14, 0.1)


@modelo('bes_zari_pata', tris=(150, 64, 24), **PIEZA)
def zari_pata(lod):
    return acabar(unir(pata_bestia(0.3, 0.048, True, 'liso', '#26324e', pie=(0.06, 0.028, 0.07), color_garra='#d89aa2', n_garras=4)), 60, 0.1, 15, 0.12)


# ═══════════ GATO INFERNAL (hellgato) ═══════════
# Rig: cuerpo (0, 0.62, 0); cabeza (0, 0.22, 0.62) del cuerpo; mandíbula (0, −0.09, 0.06) de la cabeza;
# cola (0, 0.08, −0.58) del cuerpo (sube hasta la llama en (0, 0.57, −0.4)); patas (±0.15, 0.52, 0.4 | −0.38), largo 0.5.
RUNA = '#b54cf2'


@modelo('bes_gato_cuerpo', tris=(800, 340, 110), **PIEZA)
def gato_cuerpo(lod):
    o = masa_g([(0, 0.02, 0.32, 0.19, 0.21, 0.22), (0, 0.0, 0.02, 0.15, 0.16, 0.3), (0, 0.02, -0.36, 0.18, 0.18, 0.21), (0, 0.13, 0.5, 0.12, 0.13, 0.13),
                (0.1, 0.12, 0.3, 0.07), (-0.1, 0.12, 0.3, 0.07)], voxel=0.03, tris=600, ruido_f=0.006, ruido_e=18, semilla=9)
    color_g(o, lambda P, N, C: mezclar(np.ones((len(P), 3)) * (0.9 + 0.15 * ruido_fbm(P, 9, 4, 2))[:, None], (0.55, 0.5, 0.6), np.clip(-N[:, 1], 0, 1) * 0.6))
    p = [o]
    # Runas que arden en el lomo: arcos finos de luz violeta.
    for z in (0.34, 0.14, -0.08, -0.3):
        ry = 0.2 if z > 0.2 else 0.165 if z > -0.2 else 0.18
        arco = [(math.sin(a) * 0.17, 0.02 + math.cos(a) * ry, z + 0.04 * math.cos(a)) for a in np.linspace(-1.25, 1.25, 7)]
        p.append(tubo_g(arco, 0.016, 4, 'emisivo', RUNA, punta=False))
    for z in np.linspace(0.45, -0.45, 7):   # espinazo
        y = 0.17 + 0.03 * math.cos(z * 3)
        p.append(cono_g((0, y - 0.02, z), (0, y + 0.045, z - 0.03), 0.022, 4, 'hoja', (0.45, 0.4, 0.45)))
    return acabar(unir(p), 55, 0.08, 16, 0.15)


@modelo('bes_gato_cabeza', tris=(420, 180, 64), **PIEZA)
def gato_cabeza(lod):
    cr = masa_g([(0, 0.0, 0.0, 0.16, 0.14, 0.15), (0, -0.05, 0.13, 0.09, 0.07, 0.08), (0.09, -0.03, 0.06, 0.06), (-0.09, -0.03, 0.06, 0.06)], voxel=0.02, tris=250, semilla=10)
    color_g(cr, lambda P, N, C: np.ones((len(P), 3)) * (0.95 - 0.3 * np.clip(-N[:, 1], 0, 1))[:, None])
    p = [cr, elip((0, -0.035, 0.215), (0.025, 0.018, 0.015), 1, 'liso', '#140c14')]
    for s in (1, -1):
        p.append(elip((s * 0.072, 0.035, 0.125), (0.04, 0.02, 0.02), 1, 'emisivo', '#a3ff3a'))
        p.append(elip((s * 0.072, 0.06, 0.12), (0.05, 0.016, 0.04), 1, 'hoja', (0.5, 0.45, 0.5)))           # ceño
        p.append(tubo_g([(s * 0.08, 0.08, -0.03), (s * 0.11, 0.2, -0.06), (s * 0.12, 0.28, -0.1)], [0.05, 0.03, 0.004], 5, 'hoja', TIN))   # oreja
        p.append(tubo_g([(s * 0.06, 0.11, 0.05), (s * 0.12, 0.18, -0.06), (s * 0.12, 0.17, -0.18), (s * 0.09, 0.12, -0.24)], [0.03, 0.024, 0.016, 0.004], 5, 'liso', '#cfc2a2', n=8))   # cuerno
        p.append(cono_g((s * 0.04, -0.07, 0.17), (s * 0.04, -0.13, 0.18), 0.012, 4, 'liso', '#f2ead6'))
    return acabar(unir(p), 55, 0.06, 17, 0.15)


@modelo('bes_gato_mandibula', tris=(100, 46, 18), **PIEZA)
def gato_mandibula(lod):
    j = elip((0, -0.005, 0.07), (0.07, 0.025, 0.08), 2, 'hoja', (0.8, 0.75, 0.8))
    p = [j, elip((0, 0.012, 0.07), (0.05, 0.01, 0.06), 1, 'liso', '#5a1838')]
    for s in (1, -1): p.append(cono_g((s * 0.035, 0.01, 0.12), (s * 0.035, 0.05, 0.125), 0.01, 4, 'liso', '#f2ead6'))
    return acabar(unir(p), 60, 0.04, 3, 0)


@modelo('bes_gato_cola', tris=(160, 70, 26), **PIEZA)
def gato_cola(lod):
    t = tubo_g([(0, 0, 0.04), (0, 0.18, -0.22), (0, 0.42, -0.36), (0, 0.55, -0.4)], [0.05, 0.035, 0.03, 0.03], 6, 'hoja', TIN, n=10, punta=False)
    p = [t]
    for i in range(5):   # mechón de púas antes de la llama
        a = i / 5 * 2 * math.pi
        b = np.array((0, 0.5, -0.39)); d = np.array((math.cos(a) * 0.06, 0.04, math.sin(a) * 0.06))
        p.append(cono_g(b, b + d, 0.022, 3, 'hoja', (0.5, 0.45, 0.55)))
    return acabar(unir(p), 60, 0.08, 18, 0.12)


@modelo('bes_gato_pata', tris=(180, 76, 28), **PIEZA)
def gato_pata(lod):
    return acabar(unir(pata_bestia(0.5, 0.05, True, 'hoja', (0.85, 0.82, 0.9), pie=(0.075, 0.035, 0.09), color_garra='#e6ddc4')), 60, 0.08, 19, 0.15)
