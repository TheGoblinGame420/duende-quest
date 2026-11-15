# ═══════════════════════════════════════════════════════
# DUENDE QUEST — familia ABISMO («medieval mistico»): el Abismo de Eter y el interior de la Cueva de los Goblins.
# Disenos propios, generados por guion. Los coloca el codigo (mundo/js/abismo.js y mundo/js/cueva.js) en las MISMAS
# posiciones que las piezas de antes; colisiones, puntos de interaccion y reglas del servidor no cambian.
#   · isla_panza_a/b/c: la panza de roca de una isla flotante (radio 10 m en la boca; el juego la escala con la isla),
#     con raices colgando, cristales de eter y trozos sueltos que flotan debajo.
#   · cristal_eter: racimo de cristales que asoma en las islas sin edificios.
#   · puente_roto_a/b: arranque de un puente de piedra que se vino abajo (por DEBAJO del borde: no se pisa).
#   · nucleo_torre y nucleo_cristal: la aguja de la Fortaleza del Nucleo con runas que brillan, y su cristal.
#   · estandarte_luz / estandarte_sombra: pendones de las torres de cada bastion.
#   · portal_luz / portal_sombra: los portales de vuelta de cada bastion (misma huella que el trilito de antes).
#   · cueva_roca_a/b/c, estalactita, estalagmita, cristal_cueva: el interior de la Cueva (instanciados).
# Convenio: X de Blender = x del juego, -Y = z del juego (el frente mira a -Y), Z arriba.
# ═══════════════════════════════════════════════════════
import math
import bmesh
import numpy as np
from dq_lib import *

ROCA_ETER = '#4b4553'
ROCA_OSCURA = '#2a2630'
ROCA_CLARA = '#6d6674'
TIERRA = '#3a3029'
MUSGO = '#3b4a2c'
RAIZ = '#3a2e22'
GRIS = ['#8f8a80', '#7d786f', '#99948a', '#86817a']
GRIS_P = ['#76716a', '#6a655f', '#7f7a71', '#706b64']   # piedra de los puentes: mas oscura y fria (al sol del Abismo)
HIERRO = '#33333a'
VIOLETA = ('#2a1660', '#7a4fe0', '#d2bcff')
CIAN = ('#0b3a48', '#2c9fbf', '#a6f0ff')
ORO_RUNA = '#ffcf7a'
VIO_RUNA = '#b98aff'


# ── utilidades propias de la familia ──
def mezcla(a, b, t):
    t = np.asarray(t, dtype=float)
    return hexlin(a)[None, :] * (1 - t[:, None]) + hexlin(b)[None, :] * t[:, None]


def torno(perfil, lados, nombre='torno', marca='piedra', color='#777777', fase=0.0, tapa=True):
    """Solido de revolucion. perfil: [(radio, z)] de ARRIBA a ABAJO; un radio 0 al final cierra en punta.
    tapa: cierra la boca de arriba con un abanico."""
    V = []; F = []; filas = []
    for (r, z) in perfil:
        if r <= 1e-6:
            V.append((0.0, 0.0, z)); filas.append([len(V) - 1])
        else:
            fila = []
            for k in range(lados):
                a = fase + 2 * math.pi * k / lados
                V.append((r * math.cos(a), r * math.sin(a), z)); fila.append(len(V) - 1)
            filas.append(fila)
    for f0, f1 in zip(filas[:-1], filas[1:]):
        if len(f0) == 1 and len(f1) == 1: continue
        if len(f1) == 1:
            for k in range(lados): F.append((f0[(k + 1) % lados], f0[k], f1[0]))
        elif len(f0) == 1:
            for k in range(lados): F.append((f1[k], f1[(k + 1) % lados], f0[0]))
        else:
            for k in range(lados): F.append((f0[(k + 1) % lados], f0[k], f1[k], f1[(k + 1) % lados]))
    if tapa and len(filas[0]) > 1:
        V.append((0.0, 0.0, perfil[0][1])); c = len(V) - 1
        for k in range(lados): F.append((filas[0][k], filas[0][(k + 1) % lados], c))
    o = malla(nombre, V, F, marca, color)
    bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(o.data); bm.free(); o.data.update()
    return o


def base_de(d):
    d = np.asarray(d, dtype=float); d = d / (np.linalg.norm(d) + 1e-9)
    ref = np.array([0, 0, 1.0]) if abs(d[2]) < 0.9 else np.array([1.0, 0, 0])
    u = np.cross(d, ref); u /= np.linalg.norm(u); v = np.cross(d, u)
    return d, u, v


def prisma(base, d, largo, radio, lados, paleta, sem, marca='emisivo'):
    """Cristal: prisma de `lados` que nace en `base`, crece hacia `d` y acaba en punta. Color del pie a la punta."""
    rng = azar(sem); d, u, v = base_de(d); b = np.asarray(base, dtype=float)
    V = []; T = []
    for (t, k) in ((0.0, 1.0), (0.72, rng.uniform(0.82, 0.95))):
        for i in range(lados):
            a = 2 * math.pi * i / lados + sem * 0.7
            V.append(b + d * largo * t + (u * math.cos(a) + v * math.sin(a)) * radio * k); T.append(t)
    V.append(b + d * largo); T.append(1.0)
    F = []
    for i in range(lados):
        j = (i + 1) % lados
        F.append((i, j, lados + j, lados + i)); F.append((lados + i, lados + j, 2 * lados))
    F.append(tuple(range(lados - 1, -1, -1)))
    o = malla('cristal', V, F, marca, '#ffffff')
    bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(o.data); bm.free(); o.data.update()
    T = np.array(T); k = rng.uniform(0.85, 1.12)
    C = np.where(T[:, None] < 0.5, mezcla(paleta[0], paleta[1], np.clip(T / 0.6, 0, 1)), mezcla(paleta[1], paleta[2], np.clip((T - 0.5) / 0.5, 0, 1))) * k
    poner_color(o, C)
    return suavizar(o, 12)


def racimo(centro, d, n, largo, radio, paleta, sem, lados=6, abre=0.55, marca='emisivo'):
    """n cristales que brotan de `centro` alrededor de la direccion d."""
    rng = azar(sem); d0, u, v = base_de(d); out = []
    for i in range(n):
        a = rng.uniform(0, 2 * math.pi); e = 0.0 if i == 0 else rng.uniform(0.25, 1.0) * abre
        di = d0 + (u * math.cos(a) + v * math.sin(a)) * e
        k = 1.0 if i == 0 else rng.uniform(0.45, 0.8)
        b = np.asarray(centro) + (u * math.cos(a) + v * math.sin(a)) * radio * (0 if i == 0 else rng.uniform(0.6, 1.4)) - d0 * radio * 0.6
        out.append(prisma(b, di, largo * k, radio * (1.0 if i == 0 else rng.uniform(0.55, 0.8)), lados, paleta, sem * 31 + i, marca))
    return out


def cortar(o, rng, n=8, hondo=(0.06, 0.28), arriba=0.5):
    """Planos de fractura: deja facetas de roca partida."""
    P = pos(o); c = P.mean(0)
    for _ in range(n):
        d = rng.normal(0, 1, 3); d[2] = d[2] * arriba
        d /= np.linalg.norm(d) + 1e-9
        s = (P - c) @ d; k = s.max() * (1 - rng.uniform(*hondo))
        P = P - d[None, :] * np.maximum(0, s - k)[:, None]
    poner_pos(o, P)
    return o


def piedra(sem, tam, centro=(0, 0, 0), cortes=8, subdiv=3, bulto=0.18, rot=(0, 0, 0), marca='piedra', color='#777777'):
    """Bloque de roca: esfera con bultos, partida por planos de fractura."""
    rng = azar(sem)
    o = primitiva('esfera', 'piedra', marca, color, radio=1.0, subdiv=subdiv)
    desplazar(o, bulto, 0.9, sem, 2)
    if cortes: cortar(o, rng, cortes, (0.06, 0.28), 0.6); cortar(o, rng, cortes // 2 + 2, (0.01, 0.07), 0.9)
    mover(o, (0, 0, 0), (0, 0, 0), tam)
    return mover(o, centro, rot)


def sillar(c, t, sem, lod=0, rot=(0, 0, 0), bis=0.06, rug=0.035, marca='piedra', color=None):
    """Sillar de cantos matados y piel movida. c: centro, t: tamano (x, y, z)."""
    o = primitiva('cubo', marca=marca, color=color or GRIS[sem % 4], lado=1.0)
    mover(o, esc=t)
    if lod == 0 and bis: biselar(o, min(bis, 0.22 * min(t)), 1)
    if rug and lod < 2: desplazar(o, rug, 0.8, semilla=sem, octavas=2)
    return mover(o, c, rot)


def envejecer(o, sem, musgo=0.7, pie=0.0, liquen=True):
    """Manchas, chorreras, musgo en lo que mira arriba y cantos gastados."""
    variar(o, 0.18, 0.8, semilla=sem)
    variar(o, 0.1, 2.2, semilla=sem + 2, estirar=(1, 1, 0.15))
    if liquen: variar(o, 0.08, 0.3, semilla=sem + 3, tono='#7d7862')
    if musgo: manchar(o, MUSGO, lambda P, N: N[:, 2] * 1.15 - 0.25 + np.clip(pie - P[:, 2], 0, 1) * 0.6, musgo, escala=0.7, semilla=sem + 5)
    desgastar(o, 0.3, 0.3)
    return o


def raiz(pts, r0, lod, r1=0.03, color=RAIZ):
    n = (7, 5, 4)[lod]
    return tubo(curva(pts, n), np.linspace(r0, r1, n), (4, 3, 3)[lod], 'raiz', 'madera', color)


def trazo_cil(radio_de, a0, z0, lineas, ancho, color, sale=0.04, sub=2, marca='emisivo'):
    """Runas en la piel de un solido de revolucion: lineas [(u, v)] en metros sobre la superficie (u a lo ancho,
    v hacia arriba) desde el angulo a0 y la altura z0. radio_de(z) da el radio de la piel a esa altura."""
    V = []; F = []
    for L in lineas:
        L = np.asarray(L, dtype=float); pts = []
        for a, b in zip(L[:-1], L[1:]):
            for s in range(sub): pts.append(a + (b - a) * s / sub)
        pts.append(L[-1]); pts = np.array(pts)
        Tg = np.gradient(pts, axis=0); Tg /= np.linalg.norm(Tg, axis=1)[:, None] + 1e-9
        lado = np.c_[-Tg[:, 1], Tg[:, 0]]; base = len(V)
        for p, l in zip(pts, lado):
            for sg in (-1, 1):
                q = p + l * sg * ancho / 2; z = z0 + q[1]; r = radio_de(z) + sale; a = a0 + q[0] / max(r, 0.1)
                V.append((r * math.cos(a), r * math.sin(a), z))
        for i in range(len(pts) - 1): F.append((base + 2 * i, base + 2 * i + 2, base + 2 * i + 3, base + 2 * i + 1))
    o = malla('runa', V, F, marca, color); o['dq_afilado'] = 1
    # Que miren hacia fuera.
    me = o.data; nn = np.zeros(len(me.polygons) * 3); me.polygons.foreach_get('normal', nn); cc = np.zeros(len(me.polygons) * 3); me.polygons.foreach_get('center', cc)
    nn = nn.reshape(-1, 3); cc = cc.reshape(-1, 3); cc[:, 2] = 0
    if (nn * cc).sum(1).mean() < 0: me.flip_normals(); me.update()
    return o


# Signos propios (rejilla 2 × 3): no son letras de ningun alfabeto.
GLIFOS = [
    [[(1, 0), (1, 3)], [(0, 2), (1, 3), (2, 2)]],
    [[(0, 0), (2, 3)], [(2, 0), (0, 3)]],
    [[(1, 0), (1, 1)], [(1, 1), (0, 2), (1, 3), (2, 2), (1, 1)]],
    [[(0, 0), (0, 3)], [(0, 3), (2, 2), (0, 1)], [(0, 1), (2, 0)]],
    [[(0, 3), (2, 3)], [(1, 3), (1, 0)], [(0, 0), (1, 1), (2, 0)]],
    [[(0, 0), (0, 3)], [(2, 0), (2, 3)], [(0, 2), (2, 1)]],
    [[(1, 0), (0, 1), (0, 2), (1, 3), (2, 2), (2, 1), (1, 0)], [(1, 0.8), (1, 2.2)]],
]


def glifo(k, ancho, alto):
    g = GLIFOS[k % len(GLIFOS)]
    return [[((u - 1) * ancho / 2, (v - 1.5) * alto / 3) for u, v in L] for L in g]


# ═══════════ PANZA DE LAS ISLAS FLOTANTES ═══════════
# Boca de radio 10,25 m en z = 0 (el juego la pone a la altura del borde de la isla y la escala con su radio).
PERFILES = {
    'a': [(10.25, 0.0), (10.45, -0.6), (10.1, -1.6), (9.2, -3.0), (7.9, -5.0), (6.2, -7.4), (4.4, -9.8), (2.7, -12.2), (1.3, -14.4), (0.0, -16.0)],
    'b': [(10.25, 0.0), (10.4, -0.7), (9.8, -1.8), (8.3, -3.6), (6.4, -6.0), (4.6, -8.8), (3.2, -11.8), (2.0, -14.8), (0.9, -17.6), (0.0, -19.5)],
    'c': [(10.25, 0.0), (10.5, -0.5), (10.2, -1.4), (9.6, -2.6), (8.6, -4.2), (7.0, -6.2), (5.0, -8.2), (3.0, -10.0), (1.4, -11.6), (0.0, -12.8)],
}
# Bultos que cuelgan (angulo, radio, cuanto baja, ancho) y trozos sueltos que flotan debajo (x, y, z, tam).
BULTOS = {
    'a': [(0.4, 5.5, 4.5, 2.6), (2.5, 6.5, 3.0, 2.2), (4.3, 4.5, 5.5, 2.4), (5.6, 7.2, 2.2, 1.8)],
    'b': [(1.2, 6.0, 3.2, 2.4), (3.6, 5.0, 4.4, 2.2), (5.2, 7.0, 2.4, 2.0)],
    'c': [(0.9, 4.8, 6.0, 2.8), (2.1, 6.8, 3.4, 2.2), (3.4, 4.2, 5.0, 2.6), (4.6, 7.0, 2.8, 2.0), (5.8, 5.6, 4.6, 2.4)],
}
SUELTOS = {
    'a': [(1.6, -2.4, -19.5, 1.4), (-3.4, 1.0, -21.5, 0.9), (2.6, 3.1, -24.0, 0.6)],
    'b': [(-1.8, -2.0, -22.5, 1.2), (2.4, 1.6, -25.0, 0.8)],
    'c': [(3.4, -1.2, -16.0, 1.5), (-2.2, 3.0, -17.5, 1.0), (-4.0, -3.5, -19.5, 0.7), (0.6, 0.4, -21.0, 0.5)],
}


def panza(v, lod, sem):
    perfil = PERFILES[v]
    # Mas filas que el perfil: se interpola para tener malla donde cuelgan los bultos.
    nf = (20, 13, 7)[lod]; lados = (30, 20, 11)[lod]
    zs = np.array([z for _, z in perfil]); rs = np.array([r for r, _ in perfil])
    zz = np.concatenate([[0.0, -0.6], np.linspace(-1.6, zs[-1] * 0.94, nf - 2)]) if lod < 2 else np.linspace(0, zs[-1] * 0.94, nf)
    P = [(float(np.interp(-z, -zs, rs)), float(z)) for z in zz] + [(0.0, float(zs[-1]))]
    o = torno(P, lados, 'panza', 'piedra', ROCA_ETER, fase=sem * 0.37)
    # Lobulos irregulares en planta (la boca casi no se mueve: debe casar con el borde de la isla).
    def forma(Q):
        x, y, z = Q[:, 0], Q[:, 1], Q[:, 2]
        a = np.arctan2(y, x); r = np.hypot(x, y)
        prof = np.clip(-z / 2.5, 0, 1)
        k = 1 + prof * (0.13 * np.sin(a * 3 + sem) + 0.08 * np.sin(a * 5 - sem * 2) + 0.1 * ruido_fbm(np.c_[np.cos(a) * 2, np.sin(a) * 2, z * 0.12], 1.0, sem, 2))
        r2 = r * k
        # Bultos que cuelgan: tiran hacia abajo la piel bajo su centro.
        dz = np.zeros(len(Q))
        for (ab, rb, baja, an) in BULTOS[v]:
            cx, cy = math.cos(ab) * rb, math.sin(ab) * rb
            d = np.hypot(x * k - cx, y * k - cy)
            dz -= baja * np.exp(-(d / an) ** 2) * np.clip(-z / 4.0, 0, 1)
        return np.c_[np.cos(a) * r2, np.sin(a) * r2, z + dz]
    deformar(o, forma)
    if lod < 2: desplazar(o, 0.45, 0.35, semilla=sem, octavas=3)
    if lod == 0: desplazar(o, 0.12, 1.4, semilla=sem + 1, octavas=2)
    # La boca vuelve a z = 0 (lo que asoma por encima se esconderia mal bajo el borde de la isla).
    Q = pos(o); Q[:, 2] = np.minimum(Q[:, 2], 0.0); poner_pos(o, Q)
    # Color: estratos violaceos, mas oscuros abajo; tierra y musgo en la franja de la boca.
    def col(Pv, N, C):
        z = Pv[:, 2]
        estr = np.sin(z * 2.1 + ruido(Pv, 0.25, sem + 3) * 2.2) * 0.5 + 0.5
        c = mezcla(ROCA_ETER, ROCA_CLARA, estr * 0.55)
        c = c * (1 - np.clip(-z / 18, 0, 1)[:, None] * 0.55) + hexlin(ROCA_OSCURA)[None, :] * np.clip(-z / 18, 0, 1)[:, None] * 0.55
        c *= (1 + 0.22 * ruido_fbm(Pv, 0.5, sem + 7, 3))[:, None]
        t = np.clip((z + 2.2) / 1.6, 0, 1)[:, None]
        return c * (1 - t) + hexlin(TIERRA)[None, :] * t
    pintar_fn(o, col)
    manchar(o, MUSGO, lambda Pv, N: (Pv[:, 2] + 1.0) * 1.2 + N[:, 2] * 0.4, 0.85, escala=0.6, semilla=sem + 9)
    # Vetas de eter: ruido fino que aclara hacia el violeta.
    manchar(o, '#5a4a86', lambda Pv, N: ruido_fbm(Pv, 0.9, sem + 13, 2) * 2.4 - 0.9 + (Pv[:, 2] < -3) * 0.2, 0.55, escala=1.6, semilla=sem + 14)
    desgastar(o, 0.4, 0.4)
    suavizar(o, 55)
    X = [o]
    rng = azar(sem + 100)
    # Raices: abrazan la boca, bajan pegadas a la roca y cuelgan sueltas.
    nr = (8, 5, 2)[lod]
    for i in range(nr):
        a = (i + rng.uniform(-0.3, 0.3)) / nr * 2 * math.pi
        ca, sa = math.cos(a), math.sin(a)
        r0 = float(np.interp(0.4, [0, 1], [rs[0], rs[1]])) + 0.15
        z1 = -rng.uniform(2.5, 4.5); r1 = float(np.interp(-z1, -zs, rs)) + 0.25
        largo = rng.uniform(4.0, 9.5) * (1.0 if i % 3 else 1.3)
        dx = rng.uniform(-0.6, 0.6)
        pts = [(ca * r0, sa * r0, -0.7), (ca * (r0 + 0.25), sa * (r0 + 0.25), -1.5), (ca * r1, sa * r1, z1), (ca * (r1 + 0.6) + dx, sa * (r1 + 0.6), z1 - largo * 0.5), (ca * (r1 + 0.9) + dx * 1.6, sa * (r1 + 0.9) + dx, z1 - largo)]
        X.append(raiz(pts, rng.uniform(0.16, 0.28), lod))
        if lod == 0 and i % 3 == 0:
            q = np.array(pts[2]); X.append(raiz([q, q + (ca * 0.8, sa * 0.8, -1.4), q + (ca * 1.3 + dx, sa * 1.3, -3.6)], 0.09, lod))
    # Cristales de eter brotando de la panza (mirando afuera y abajo).
    nc = (5, 3, 2)[lod]
    for i in range(nc):
        a = (i + 0.5 + rng.uniform(-0.25, 0.25)) / nc * 2 * math.pi
        z = -rng.uniform(3.5, 9.5); r = float(np.interp(-z, -zs, rs)) * 0.9
        d = (math.cos(a) * 0.8, math.sin(a) * 0.8, -1.0)
        pal = CIAN if i % 3 == 1 else VIOLETA
        X += racimo((math.cos(a) * r, math.sin(a) * r, z), d, (3, 2, 1)[lod], rng.uniform(2.2, 3.8), rng.uniform(0.32, 0.5), pal, sem * 7 + i, (6, 5, 4)[lod])
    # La punta: un cristal grande que cuelga del fondo.
    X += racimo((0.3, -0.2, zs[-1] * 0.9), (0.1, 0.05, -1), (3, 1, 1)[lod], 3.4, 0.6, VIOLETA, sem + 50, (6, 5, 4)[lod], abre=0.35)
    # Trozos sueltos que flotan debajo.
    if lod < 2:
        for j, (x, y, z, t) in enumerate(SUELTOS[v]):
            if lod == 1 and j > 1: break
            p = piedra(sem * 11 + j, (t, t * 0.85, t * 1.25), (x, y, z), 7, (2, 1)[lod], 0.2, color=ROCA_ETER)
            pintar_fn(p, lambda Pv, N, C: mezcla(ROCA_ETER, ROCA_OSCURA, np.clip((Pv[:, 2] - z) / -t * 0.5 + 0.4, 0, 1)) * (1 + 0.2 * ruido_fbm(Pv, 1.5, sem + j, 2))[:, None])
            manchar(p, MUSGO, lambda Pv, N: N[:, 2] * 1.4 - 0.2, 0.8, escala=1.2, semilla=sem + j)
            decimar(p, (70, 40)[lod]); desgastar(p, 0.4, 0.3); suavizar(p, 35)
            X.append(p)
            if lod == 0: X += racimo((x, y, z - t * 0.9), (0, 0, -1), 2, t * 1.6, t * 0.28, VIOLETA if j % 2 else CIAN, sem + 60 + j, 5)
    return X


T_PANZA = (2800, 950, 280)


@modelo('isla_panza_a', tris=T_PANZA, ao=0.7, ao_dist=2.4, suelo=False)
def isla_panza_a(lod): return panza('a', lod, 3)


@modelo('isla_panza_b', tris=T_PANZA, ao=0.7, ao_dist=2.4, suelo=False)
def isla_panza_b(lod): return panza('b', lod, 17)


@modelo('isla_panza_c', tris=T_PANZA, ao=0.7, ao_dist=2.4, suelo=False)
def isla_panza_c(lod): return panza('c', lod, 29)


# ═══════════ CRISTAL DE ETER (encima de las islas sin edificios) ═══════════
@modelo('cristal_eter', tris=(300, 120, 40), ao=0.5)
def cristal_eter(lod):
    X = racimo((0, 0, -0.3), (0.05, 0.02, 1), (6, 4, 2)[lod], 3.2, 0.42, VIOLETA, 5, (6, 5, 4)[lod], abre=0.6)
    if lod < 2:
        p = piedra(41, (0.95, 0.8, 0.45), (0, 0, -0.1), 6, (2, 1)[lod], 0.2, color=ROCA_ETER)
        pintar_fn(p, lambda Pv, N, C: mezcla(ROCA_ETER, ROCA_CLARA, np.clip(N[:, 2], 0, 1) * 0.4) * (1 + 0.2 * ruido_fbm(Pv, 2, 3, 2))[:, None])
        desgastar(p, 0.4, 0.3); suavizar(p, 35)
        X.append(p)
    return X


# ═══════════ PUENTES ROTOS ═══════════
# Nacen en x = -2,5 (metidos en el risco), salen hacia +X y se rompen. La cara de arriba del tablero esta en z = 0
# (el juego la deja unos metros POR DEBAJO del borde de la isla: se ve, pero no se pisa).
def puente(lod, sem, largo, cuelga=False):
    rng = azar(sem); S = []
    sillar_ = globals()['sillar']
    def sillar(c, t, s_, lod, rot=(0, 0, 0)): return sillar_(c, t, s_, lod, rot=rot, color=GRIS_P[s_ % 4])
    caida = lambda x: -0.018 * max(0.0, x) ** 2
    n = int(largo)
    for i in range(-2, n):
        x = i + 0.5; ult = i == n - 1
        L = 0.96 if not ult else rng.uniform(0.45, 0.7)
        rot = (rng.uniform(-0.03, 0.03), rng.uniform(-0.02, 0.02) + (0.12 if ult else 0), rng.uniform(-0.02, 0.02))
        S.append(sillar((x - (0.5 - L / 2 if ult else 0), rng.uniform(-0.05, 0.05), caida(x) - 0.3), (L, 3.1 - (0.6 if ult else 0), 0.6), sem + i * 3, lod, rot=rot))
        # Pretiles: faltan piedras, y en el tramo roto ya no hay.
        if lod < 2:
            for s in (-1, 1):
                if x > largo - 2.2 or rng.uniform() < 0.22: continue
                S.append(sillar((x, s * 1.38, caida(x) + 0.3), (0.9, 0.34, 0.6), sem + i * 7 + s, lod, rot=(0, 0, rng.uniform(-0.05, 0.05))))
    # Arco de dovelas bajo el tablero (de la roca al tablero), roto antes del final.
    na = (7, 5, 3)[lod]
    for k in range(na):
        t0 = k / na; t1 = (k + 1) / na
        a0 = math.pi * 0.5 * t0; a1 = math.pi * 0.5 * t1
        p0 = np.array([-1.6 + 6.4 * (1 - math.cos(a0)), 0, -5.6 + 4.6 * math.sin(a0)]); p1 = np.array([-1.6 + 6.4 * (1 - math.cos(a1)), 0, -5.6 + 4.6 * math.sin(a1)])   # sube primero y se tiende bajo el tablero
        if p1[0] > largo - 1.5: break
        c = (p0 + p1) / 2; d = p1 - p0
        S.append(sillar(tuple(c), (float(np.linalg.norm(d)) * 0.96, 2.6, 0.75), sem + 50 + k, lod, rot=(0, -math.atan2(d[2], d[0]), 0)))
    # Relleno entre el arco y el tablero junto al risco.
    if lod < 2:
        S.append(sillar((-1.9, 0, -2.6), (1.2, 2.7, 3.6), sem + 70, lod))
        S.append(sillar((0.2, 0, -1.25), (1.5, 2.6, 1.3), sem + 71, lod))
    if cuelga and lod < 2:
        # Un tramo que se quedo colgando del extremo roto, casi vertical.
        x0 = n - 0.1; z0 = caida(n) - 0.3; th = 0.45
        for j in range(3):
            d = 0.5 + j * 0.99
            S.append(sillar((x0 + math.sin(th) * d, rng.uniform(-0.08, 0.08), z0 - math.cos(th) * d), (0.96, 2.9 - j * 0.35, 0.6), sem + 80 + j, lod, rot=(rng.uniform(-0.06, 0.06), math.pi / 2 - th + rng.uniform(-0.06, 0.06), 0)))
    o = unir(S)
    decimar(o, (900, 330, 100)[lod] - (130 if lod == 0 else 0))
    envejecer(o, sem, musgo=0.75)
    suavizar(o, 40)
    X = [o]
    if lod == 0:
        # Raices que se cuelan por las juntas y cuelgan del borde roto.
        X.append(raiz([(largo - 1.2, 0.6, -0.4), (largo - 0.8, 0.9, -1.4), (largo - 0.6, 1.2, -3.2), (largo - 0.4, 1.0, -5.0)], 0.1, 0))
        X.append(raiz([(1.5, -1.5, -0.2), (1.8, -1.65, -1.2), (2.0, -1.6, -2.6)], 0.07, 0))
    return X


@modelo('puente_roto_a', tris=(900, 330, 100), ao=0.75, ao_dist=1.4, suelo=False)
def puente_roto_a(lod): return puente(lod, 11, 8)


@modelo('puente_roto_b', tris=(900, 330, 100), ao=0.75, ao_dist=1.4, suelo=False)
def puente_roto_b(lod): return puente(lod, 23, 5, cuelga=True)


# ═══════════ AGUJA DEL NUCLEO ═══════════
# Sustituye al cilindro de 26 m (radio 7 abajo, 5 arriba). Origen en el pie; el cristal del Nucleo (aparte, gira y
# toma el color del dueno) flota a 31 m. Los contrafuertes evitan el oeste (alli despierta el Guardian).
PERFIL_TORRE = [(5.55, 26.2), (5.55, 25.6), (5.95, 25.2), (5.95, 24.3), (5.3, 23.9), (5.45, 20.0), (5.75, 16.0), (6.05, 12.0), (6.35, 8.0), (6.65, 4.0), (6.9, 1.6), (7.35, 1.3), (7.35, 0.0), (7.35, -0.5)]


def radio_torre(z):
    zs = [z for _, z in PERFIL_TORRE][::-1]; rs = [r for r, _ in PERFIL_TORRE][::-1]
    return float(np.interp(z, zs, rs))


@modelo('nucleo_torre', tris=(3800, 1250, 460), ao=0.75, ao_dist=3.0)
def nucleo_torre(lod):
    lados = (24, 14, 8)[lod]
    P = list(PERFIL_TORRE)
    if lod == 0:   # mas filas en el fuste (hiladas)
        P = P[:5] + [(radio_torre(z), z) for z in np.arange(23.0, 1.7, -1.3)] + P[-4:]
    o = torno(P, lados, 'torre', 'piedra', '#6a6570', fase=math.pi / lados)
    if lod < 2: desplazar(o, 0.08, 0.6, semilla=5, octavas=2)

    def col(Pv, N, C):
        z = Pv[:, 2]; a = np.arctan2(Pv[:, 1], Pv[:, 0])
        hil = np.floor(z / 1.3); f = z / 1.3 - hil
        junta = np.exp(-(np.minimum(f, 1 - f) / 0.08) ** 2) * 0.35
        vert = np.exp(-((np.mod(a * 6.0 / math.pi + hil * 0.5, 1.0) - 0.5) / 0.05) ** 2) * 0.25
        c = mezcla('#5f5a66', '#7b7682', (np.sin(hil * 12.9898) * 0.5 + 0.5) * 0.6)
        c *= (1 - junta - vert)[:, None]
        c *= (1 + 0.18 * ruido_fbm(Pv, 0.35, 7, 3))[:, None]
        return c
    pintar_fn(o, col)
    manchar(o, '#3a2f4a', lambda Pv, N: np.clip(4.0 - Pv[:, 2], 0, 4) / 4 * 0.9 + ruido(Pv, 0.4, 3) * 0.2, 0.7, escala=0.5, semilla=8)   # pie humedo
    manchar(o, MUSGO, lambda Pv, N: N[:, 2] * 1.3 - 0.1, 0.8, escala=0.8, semilla=9)
    desgastar(o, 0.35, 0.35)
    suavizar(o, 50)
    X = [o]
    # Contrafuertes (8, girados medio paso: ninguno al oeste).
    nb = 8
    for k in range(nb):
        a = (k + 0.5) / nb * 2 * math.pi
        if abs(math.cos(a) + 1) < 0.05: continue
        ca, sa = math.cos(a), math.sin(a)
        r0 = 6.6; alto = 11.0; sale = 1.75
        V = [(0, -0.55, 0), (0, 0.55, 0), (sale, -0.5, 0), (sale, 0.5, 0), (sale * 0.55, -0.45, alto * 0.45), (sale * 0.55, 0.45, alto * 0.45), (0, -0.4, alto), (0, 0.4, alto)]
        F = [(0, 2, 3, 1), (2, 4, 5, 3), (4, 6, 7, 5), (0, 1, 7, 6), (0, 6, 4, 2), (1, 3, 5, 7)]
        b = malla('contrafuerte', V, F, 'piedra', '#6f6a74')
        bm = bmesh.new(); bm.from_mesh(b.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(b.data); bm.free(); b.data.update()
        if lod == 0: biselar(b, 0.12, 1)
        mover(b, (ca * r0, sa * r0, 0.0), (0, 0, a))
        envejecer(b, 20 + k, musgo=0.8)
        suavizar(b, 40)
        X.append(b)
        # Runa vertical en cada contrafuerte.
        if lod < 2:
            X.append(trazo_cil(lambda z: r0 + sale - 0.45 * sale * min(z, alto * 0.45) / (alto * 0.45) + 0.06, a, 3.6, glifo(k, 0.55, 2.2), (0.11, 0.15)[lod], VIO_RUNA, 0.03, (2, 1)[lod]))
    # Bandas de runas alrededor del fuste.
    for (zb, n, alto_g) in ((7.5, 18, 1.4), (15.0, 16, 1.3), (22.0, 14, 1.2)):
        if lod > 0 and zb != 15.0: continue
        rz = radio_torre(zb)
        lin = []
        paso = 2 * math.pi * rz / n
        for i in range(n if lod < 2 else n // 2):
            u0 = i * paso * (1 if lod < 2 else 2)
            lin += [[(u + u0, v) for u, v in L] for L in (glifo(i * 3 + int(zb), 0.55, alto_g) if lod < 2 else [[(0, -alto_g / 2), (0, alto_g / 2)]])]
        X.append(trazo_cil(radio_torre, 0.0, zb, lin, (0.1, 0.14, 0.3)[lod], VIO_RUNA, 0.11, 1))
        if lod < 2:
            # Filetes de piedra arriba y abajo de la banda.
            for dz in (-alto_g * 0.75, alto_g * 0.75):
                z0 = zb + dz; r0 = radio_torre(z0) + 0.12
                f = torno([(r0, z0 + 0.14), (r0 + 0.08, z0), (r0, z0 - 0.14)], lados, 'filete', 'piedra', '#77727c', tapa=False)
                envejecer(f, 31, musgo=0.5); suavizar(f, 40); X.append(f)
    # Corona: seis cuernos de piedra que se cierran sobre el cristal.
    nk = (6, 6, 3)[lod]
    for k in range(nk):
        a = k / nk * 2 * math.pi + 0.3
        ca, sa = math.cos(a), math.sin(a)
        pts = [(ca * 4.7, sa * 4.7, 25.9), (ca * 5.2, sa * 5.2, 27.4), (ca * 4.9, sa * 4.9, 28.9), (ca * 4.1, sa * 4.1, 30.1), (ca * 3.4, sa * 3.4, 30.6)]
        c = tubo(curva(pts, (8, 5, 3)[lod]), np.linspace(0.75, 0.12, (8, 5, 3)[lod]), (6, 4, 3)[lod], 'cuerno', 'piedra', '#6d6873')
        envejecer(c, 40 + k, musgo=0.0, liquen=False); X.append(c)
        if lod < 2:
            X.append(trazo_cil(lambda z: 5.0 + 0.4 - (z - 26) * 0.12, a, 27.6, [[(0, -0.9), (0, 0.9)]], 0.16, VIO_RUNA, 0.25, 2))
    # Pila de la cima (cuenco donde se apoya la luz del cristal), con un brillo en el fondo.
    cu = torno([(4.9, 26.7), (5.2, 26.4), (4.6, 26.1), (0.1, 25.8)], lados, 'cuenco', 'piedra', '#625d69')
    suavizar(cu, 40); X.append(cu)
    br = torno([(3.6, 26.35), (0.01, 26.3)], lados, 'brillo', 'emisivo', '#9a6cff', tapa=False)
    X.append(br)
    if lod == 0:
        # Escombros al pie.
        for j, (a, r, t) in enumerate(((0.9, 8.6, 0.6), (2.2, 8.3, 0.45), (4.0, 8.7, 0.7), (5.5, 8.4, 0.5))):
            p = piedra(70 + j, (t, t * 0.8, t * 0.6), (math.cos(a) * r, math.sin(a) * r, t * 0.3), 6, 2, 0.2, color='#6f6a74')
            envejecer(p, 70 + j, musgo=0.8); suavizar(p, 35); X.append(p)
    return X


# ═══════════ CRISTAL DEL NUCLEO ═══════════
# Lo dibuja un material basico del color del dueno: aqui solo van claros y oscuros por faceta (blanco = color pleno).
@modelo('nucleo_cristal', tris=(160, 90, 40), ao=0.0)
def nucleo_cristal(lod):
    lados = (8, 6, 5)[lod]
    P = [(0.0, 4.2), (1.5, 1.6), (2.4, 0.2), (1.9, -1.4), (0.0, -3.9)]
    o = torno(P, lados, 'nucleo', 'emisivo', '#ffffff', fase=0.2, tapa=False)
    # Que la cumbre no quede centrada: tuerce un poco la punta.
    deformar(o, lambda Q: Q + np.c_[Q[:, 2] * 0.06, Q[:, 2] * -0.03, np.zeros(len(Q))])
    bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.split_edges(bm, edges=bm.edges); bm.to_mesh(o.data); bm.free(); o.data.update()
    luz = np.array([0.45, -0.55, 0.7]); luz /= np.linalg.norm(luz)
    pintar_fn(o, lambda Q, N, C: np.repeat((0.55 + 0.45 * np.clip(N @ luz, 0, 1) + 0.12 * np.clip(Q[:, 2] / 4, -1, 1))[:, None], 3, axis=1))
    return suavizar(o, 5)


# ═══════════ ESTANDARTES DE LAS FACCIONES ═══════════
# Medida de la pieza del kit que sustituyen: 2,27 m de ancho y 7,8 m de alto colgando de la cara de la torre
# (+X mira hacia fuera). Origen en el pie del pano.
def estandarte(lod, tela, ribete, emblema, forma, sem):
    X = []
    alto = 7.6; ancho = 2.2
    nu = (6, 4, 2)[lod]; nv = (12, 6, 3)[lod]
    V = []; F = []
    for j in range(nv + 1):
        t = j / nv; z = alto * (1 - t)
        for i in range(nu + 1):
            s = i / nu; y = (s - 0.5) * ancho
            # Punta en cola de golondrina abajo, y ondas suaves de tela.
            if t > 0.82: y *= 1 - 0.25 * (t - 0.82) / 0.18
            x = 0.16 + 0.04 * math.sin(s * 5.5 + sem) * (0.3 + t) + 0.04 * math.sin(t * 7 + sem)
            V.append((x, y, z))
    for j in range(nv):
        for i in range(nu):
            a = j * (nu + 1) + i; F.append((a, a + 1, a + nu + 2, a + nu + 1))
    # Cola de golondrina: baja las esquinas.
    o = malla('pano', V, F, 'liso', tela)
    def cola(Q):
        t = 1 - Q[:, 2] / alto; s = np.abs(Q[:, 1]) / (ancho / 2)
        return np.c_[Q[:, 0], Q[:, 1], Q[:, 2] - np.clip((t - 0.8) / 0.2, 0, 1) * s * 0.9 + np.clip((t - 0.8) / 0.2, 0, 1) * (1 - s) * 0.5]
    deformar(o, cola)
    def col(Q, N, C):
        s = np.abs(Q[:, 1]) / (ancho / 2); z = Q[:, 2]
        borde = (s > 0.8) | (z > alto - 0.55)
        c = np.where(borde[:, None], hexlin(ribete)[None, :], hexlin(tela)[None, :])
        return c * (1 + 0.15 * ruido_fbm(Q, 1.2, sem, 2))[:, None] * (0.75 + 0.25 * np.clip(z / alto + 0.3, 0, 1))[:, None]
    pintar_fn(o, col)
    if lod < 2: variar(o, 0.1, 3.0, semilla=sem + 1)
    dos_caras(o)
    X.append(o)
    # Emblema delante del pano (por las dos caras).
    cz = alto * 0.58; xe = 0.31
    if forma == 'sol':
        nr = (12, 8, 6)[lod]
        disco = torno([(0.42, 0.0), (0.0, 0.0)], nr, 'disco', 'emisivo', emblema, tapa=False)
        mover(disco, (0, 0, 0), (0, math.pi / 2, 0)); mover(disco, (xe, 0, cz))
        X.append(disco)
        if lod < 2:
            for k in range(8):
                a = k / 8 * 2 * math.pi; r0 = 0.52; r1 = 0.85 if k % 2 == 0 else 0.7
                V = [(xe, math.cos(a - 0.12) * r0, cz + math.sin(a - 0.12) * r0), (xe, math.cos(a + 0.12) * r0, cz + math.sin(a + 0.12) * r0), (xe, math.cos(a) * r1, cz + math.sin(a) * r1)]
                X.append(malla('rayo', V, [(0, 1, 2)], 'emisivo', emblema))
    else:
        # Luna creciente con un ojo: dos arcos que se cierran en puntas.
        n = (12, 8, 5)[lod]; V = []
        for i in range(n + 1):
            a = -1.15 * math.pi / 2 + i / n * 1.15 * math.pi
            V.append((xe, math.cos(a) * 0.85 - 0.12, cz + math.sin(a) * 0.85))
            V.append((xe, math.cos(a) * 0.55 * (1 - 0.3 * math.cos(a)) + 0.12, cz + math.sin(a) * 0.62))
        F = [(2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1) for i in range(n)]
        X.append(malla('luna', V, F, 'emisivo', emblema))
        if lod < 2:
            ojo = torno([(0.12, 0.0), (0.0, 0.0)], 6, 'ojo', 'emisivo', emblema, tapa=False)
            mover(ojo, (0, 0, 0), (0, math.pi / 2, 0)); mover(ojo, (xe, -0.62, cz)); X.append(ojo)
    for e in X[1:]: dos_caras(e)
    # Travesano y brazo de hierro que lo sujeta a la torre.
    trav = tubo([(0.2, -ancho / 2 - 0.2, alto + 0.05), (0.2, ancho / 2 + 0.2, alto + 0.05)], 0.07, (6, 4, 3)[lod], 'travesano', 'liso', HIERRO, punta=False)
    X.append(trav)
    if lod < 2:
        for s in (-1, 1):
            X.append(primitiva('esfera', 'remate', 'liso', ribete, radio=0.12, subdiv=0))
            mover(X[-1], (0.2, s * (ancho / 2 + 0.25), alto + 0.05))
        X.append(tubo([(-0.1, 0, alto + 0.4), (0.2, 0, alto + 0.15)], 0.06, 4, 'brazo', 'liso', HIERRO, punta=False))
    return X


@modelo('estandarte_luz', tris=(560, 200, 60), ao=0.4, ao_dist=0.6, suelo=False)
def estandarte_luz(lod): return estandarte(lod, '#24406c', '#b8923e', '#ffd27a', 'sol', 3)


@modelo('estandarte_sombra', tris=(560, 200, 60), ao=0.4, ao_dist=0.6, suelo=False)
def estandarte_sombra(lod): return estandarte(lod, '#4a1724', '#2b2530', '#b07cff', 'luna', 7)


# ═══════════ PORTALES DE LOS BASTIONES ═══════════
# Misma huella que el trilito de antes: jambas en x = ±2,1, hueco de 3 m (el velo mide 3 × 4,4 y su centro esta a
# 2,3 m). Frente hacia -Y. Luz: caliza clara con arco apuntado y runas doradas. Sombra: basalto con cuernos y runas
# violetas.
A_OJIVA = math.acos(1 - 2.1 / 3.0)   # arco apuntado de radio 3 m que cierra en x = 0


def portal(lod, luz):
    sem = 300 if luz else 400
    piedra_c = ['#b3ad9f', '#a39e92', '#bcb6a8', '#aaa498'] if luz else ['#3e3a44', '#46414d', '#38343e', '#423d48']
    runa_c = ORO_RUNA if luz else VIO_RUNA
    S = []
    for s in (-1, 1):
        # Jamba de sillares (de 1,1 × 1,1) sobre un zocalo.
        S.append(sillar((s * 2.15, 0, 0.25), (1.45, 1.45, 0.7), sem + s, lod, color=piedra_c[0]))
        z = 0.6
        for i, h in enumerate((1.25, 1.15, 1.2, 1.1)):
            S.append(sillar((s * 2.1, 0, z + h / 2), (1.1, 1.1, h - 0.04), sem + 10 + i * 2 + s, lod, rot=(0, 0, 0.02 * s), color=piedra_c[(i + 1) % 4]))
            z += h
        if lod < 2: S.append(sillar((s * 2.95, -0.05, 0.3), (0.7, 1.0, 0.9), sem + 30 + s, lod, rot=(0, s * 0.15, 0.2), color=piedra_c[2]))
    # Arco: dovelas de 5,3 m de luz desde las impostas (z = 5,3).
    nd = (9, 7, 3)[lod]
    for k in range(nd):
        t0 = k / nd; t1 = (k + 1) / nd
        if luz:   # apuntado: dos arcos de circulo de centro desplazado
            def pt(t):
                if t <= 0.5:
                    a = A_OJIVA * (t / 0.5); return np.array([-2.1 + 3.0 * (1 - math.cos(a)), 0, 5.3 + 3.0 * math.sin(a)])
                a = A_OJIVA * ((1 - t) / 0.5); return np.array([2.1 - 3.0 * (1 - math.cos(a)), 0, 5.3 + 3.0 * math.sin(a)])
        else:     # medio punto rebajado
            def pt(t):
                a = math.pi * t; return np.array([-2.1 * math.cos(a), 0, 5.3 + 1.6 * math.sin(a)])
        p0 = pt(t0); p1 = pt(t1); c = (p0 + p1) / 2; d = p1 - p0
        L = float(np.linalg.norm(d))
        S.append(sillar(tuple(c + np.array([0, 0, 0.25])), (L + 0.08, 1.05, 0.95), sem + 50 + k, lod, rot=(0, -math.atan2(d[2], d[0]), 0), color=piedra_c[k % 4]))
    p = unir(S)
    decimar(p, (1300, 440, 120)[lod])
    envejecer(p, sem, musgo=0.55 if luz else 0.25)
    suavizar(p, 40)
    X = [p]
    # Runas en las jambas (las dos caras) y en la clave.
    if lod < 2:
        for f in (-1, 1):
            for s in (-1, 1):
                for i in range(3):
                    lin = glifo(i * 2 + (s > 0) + (f > 0) * 3, 0.42, 0.62)
                    V = []; F = []
                    for L in lin:
                        L = np.array(L); n = len(L)
                        for a, b in zip(L[:-1], L[1:]):
                            d = b - a; d = d / (np.linalg.norm(d) + 1e-9); l = np.array([-d[1], d[0]]) * (0.045 if lod == 0 else 0.06)
                            base = len(V)
                            for q in (a - l, a + l, b + l, b - l): V.append((s * 2.1 + q[0], f * 0.6, 1.6 + i * 1.15 + q[1]))
                            F.append((base, base + 1, base + 2, base + 3))
                    r = malla('runa', V, F, 'emisivo', runa_c)
                    me = r.data; nn = np.zeros(len(me.polygons) * 3); me.polygons.foreach_get('normal', nn)
                    if nn.reshape(-1, 3)[:, 1].mean() * f < 0: me.flip_normals(); me.update()
                    X.append(r)
    # Emblema en la clave: sol (Luz) o cuernos y ojo (Sombra).
    ztop = 5.3 + (3.0 * math.sin(A_OJIVA) if luz else 1.6) + 0.25   # centro de la clave
    if luz:
        for f in (-1, 1):
            d = torno([(0.36, 0.0), (0.0, 0.0)], (10, 8, 6)[lod], 'sol', 'emisivo', ORO_RUNA, tapa=False)
            mover(d, (0, 0, 0), (math.pi / 2 * -f, 0, 0)); mover(d, (0, f * 0.57, ztop)); X.append(d)
        if lod < 2:
            rem = torno([(0.0, 1.2), (0.28, 0.5), (0.35, 0.0), (0.0, -0.05)], 6, 'remate', 'piedra', piedra_c[1])
            mover(rem, (0, 0, ztop + 0.4)); envejecer(rem, 333, musgo=0.4); X.append(rem)
    else:
        for s in (-1, 1):
            pts = [(s * 1.6, 0, ztop - 0.4), (s * 2.4, 0, ztop + 0.3), (s * 2.9, 0, ztop + 1.3), (s * 2.7, 0, ztop + 2.3)]
            c = tubo(curva(pts, (7, 5, 3)[lod]), np.linspace(0.42, 0.06, (7, 5, 3)[lod]), (6, 4, 3)[lod], 'cuerno', 'piedra', '#2f2b35')
            envejecer(c, 410 + s, musgo=0.0, liquen=False); X.append(c)
        for f in (-1, 1):
            n = (10, 8, 6)[lod]; V = []
            for i in range(n + 1):
                a = math.pi * i / n
                V.append((math.cos(a) * 0.5, f * 0.57, ztop + math.sin(a) * 0.22)); V.append((math.cos(a) * 0.5, f * 0.57, ztop - math.sin(a) * 0.22))
            F = [(2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1) for i in range(n)]
            o = malla('ojo', V, F, 'emisivo', VIO_RUNA)
            me = o.data; nn = np.zeros(len(me.polygons) * 3); me.polygons.foreach_get('normal', nn)
            if nn.reshape(-1, 3)[:, 1].mean() * f < 0: me.flip_normals(); me.update()
            X.append(o)
    # Losa del umbral.
    X.append(sillar((0, 0, -0.08), (3.3, 1.6, 0.24), sem + 90, lod, color=piedra_c[3]))
    return X


@modelo('portal_luz', tris=(1700, 560, 170), ao=0.8)
def portal_luz(lod): return portal(lod, True)


@modelo('portal_sombra', tris=(1700, 560, 170), ao=0.8)
def portal_sombra(lod): return portal(lod, False)


# ═══════════ INTERIOR DE LA CUEVA (instanciados) ═══════════
# Se dibujan con un material del juego que multiplica el color por el de cada copia (la luz de antorcha horneada):
# por eso el color de aqui es CLARO (blanco = el tono de la copia tal cual).
def roca_cueva(lod, sem):
    # Mismo bulto que el dodecaedro de radio 0,85 de antes, centrado en el origen.
    o = piedra(sem, (0.92, 0.86, 0.9), (0, 0, 0), (9, 7, 4)[lod], (3, 2, 1)[lod], 0.22, color='#e8e4ec')
    decimar(o, (110, 62, 34)[lod])
    def col(Q, N, C):
        c = mezcla('#f0ecf2', '#c9c2cf', np.clip(ruido_fbm(Q, 1.6, sem, 3) * 1.2 + 0.4, 0, 1))
        return c * (0.85 + 0.15 * np.clip(N[:, 2] + 0.5, 0, 1))[:, None]
    pintar_fn(o, col)
    manchar(o, '#a7b39a', lambda Q, N: N[:, 2] * 1.3 - 0.4, 0.45, escala=2.0, semilla=sem + 3)
    desgastar(o, 0.45, 0.45)
    return suavizar(o, 34)


@modelo('cueva_roca_a', tris=(110, 62, 34), ao=0.45, ao_dist=0.5, suelo=False)
def cueva_roca_a(lod): return roca_cueva(lod, 5)


@modelo('cueva_roca_b', tris=(110, 62, 34), ao=0.45, ao_dist=0.5, suelo=False)
def cueva_roca_b(lod): return roca_cueva(lod, 12)


@modelo('cueva_roca_c', tris=(110, 62, 34), ao=0.45, ao_dist=0.5, suelo=False)
def cueva_roca_c(lod): return roca_cueva(lod, 27)


@modelo('estalagmita', tris=(96, 66, 20), ao=0.4, ao_dist=0.3)
def estalagmita(lod):
    # 1 m de alto (el juego la estira de 1,2 a 3,6), radio 0,45 al pie. Origen en el pie.
    lados = (8, 6, 4)[lod]
    P = [(0.0, 1.0), (0.09, 0.86), (0.16, 0.66), (0.24, 0.44), (0.33, 0.22), (0.43, 0.05), (0.5, -0.08)] if lod < 2 else [(0.0, 1.0), (0.24, 0.44), (0.5, -0.08)]
    o = torno(P, lados, 'estalagmita', 'piedra', '#dcd6e0', tapa=False)
    if lod < 2: deformar(o, lambda Q: Q + np.c_[np.sin(Q[:, 2] * 7) * 0.03, np.cos(Q[:, 2] * 5) * 0.025, np.zeros(len(Q))])
    pintar_fn(o, lambda Q, N, C: mezcla('#b9b0c0', '#f4f0f6', np.clip(Q[:, 2], 0, 1) * 0.7 + (np.sin(Q[:, 2] * 22) * 0.5 + 0.5) * 0.25))
    return suavizar(o, 40)


@modelo('estalactita', tris=(96, 66, 20), ao=0.0)
def estalactita(lod):
    # Cuelga del techo: la base en z = 0 y la punta en z = -1 (el juego la estira).
    lados = (8, 6, 4)[lod]
    P = [(0.5, 0.06), (0.4, -0.06), (0.28, -0.25), (0.2, -0.45), (0.13, -0.65), (0.07, -0.85), (0.0, -1.0)] if lod < 2 else [(0.5, 0.06), (0.2, -0.45), (0.0, -1.0)]
    o = torno(P, lados, 'estalactita', 'piedra', '#dcd6e0', tapa=False)
    if lod < 2: deformar(o, lambda Q: Q + np.c_[np.sin(Q[:, 2] * 6) * 0.03, np.cos(Q[:, 2] * 4) * 0.02, np.zeros(len(Q))])
    pintar_fn(o, lambda Q, N, C: mezcla('#f2eef4', '#a69eae', np.clip(-Q[:, 2], 0, 1) * 0.6 + (np.sin(Q[:, 2] * 25) * 0.5 + 0.5) * 0.2))
    return suavizar(o, 40)


@modelo('cristal_cueva', tris=(170, 80, 30), ao=0.0)
def cristal_cueva(lod):
    # Racimo de 1,6 m sobre el suelo (antes un octaedro suelto). Lo dibuja un material sin luz: el color es el brillo.
    return racimo((0, 0, -0.15), (0.08, 0.04, 1), (5, 3, 1)[lod], 1.55, 0.2, ('#0d4252', '#38b8d6', '#c4f6ff'), 9, (6, 5, 4)[lod], abre=0.7)
