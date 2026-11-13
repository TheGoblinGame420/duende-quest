# ═══════════════════════════════════════════════════════
# DUENDE QUEST — familia EDIFICIOS del Pueblo Duende («medieval mistico»)
# Diseños propios, generados por guion: siete casas y el campanario, cada uno modelado entero y
# con la MISMA huella que la caja de choque de su sitio (CASAS en mmo/js/mundo3d.js): w a lo
# ancho (X), d de fondo (Y), puerta hacia -Y (en el juego, +Z), origen en el suelo y en el centro.
#
# El juego los funde con el material de obra (mundo/js/arquitectura.js, crearEdificios): sombreado
# plano y textura procedural segun la marca de cada cara:
#   piedra = sillares · madera y puerta = tablas con veta · teja = tejas (o paja si el color es pajizo)
#   liso = yeso, hierro, barro · vidrio = vidriera que se enciende de noche · emisivo = brasa
# El color por vertice lleva el tono, la suciedad, el musgo y la oclusion (se hornea AQUI, no en
# dq_lib: ao=0, porque la de la biblioteca arranca a 3 cm y mancha lo que queda bajo un marco).
# `sustituye` lleva datos para el juego: {'casa': indice de CASAS | 'torre': 1, 'humo': [[x,y,z]],
# 'fuego': [[x,y,z,tam]]} en coordenadas del juego (x, alto, z) relativas al origen del modelo.
#
# GANCHOS (probados los tres el 12-nov-2026, con capturas):
#   · USADO: PAQ.geo(nombre, nivel) + KIT.material. crearEdificios() pone un THREE.LOD por edificio (alto hasta 72 m,
#     medio hasta 165 m, bajo mas lejos; en minima y baja nunca el alto) con el material de obra: valen todas las marcas.
#     La marca va con + 0,5 para que el material sepa que el color viene horneado (no lo reinterpreta como en el kit).
#   · propios(nombre, [{x, y, z, rot, s}]): FUNCIONA (coloca las copias con sus niveles y su recorte), pero dibuja con el
#     material organico: sombreado suave, sin sillares ni tejas ni vidrieras de noche, el musgo de la zona tiñe la piedra
#     y, si el modelo llevara `viento`, se meceria. Sirve para decorado suelto (menhires, tocones), no para edificios.
#   · {'kit': 'p_chimney'}: FUNCIONA (KIT.sustituir cambia la malla de la pieza: las casas del kit salieron con la
#     chimenea nueva), pero quien llama a fundir() con `t:` pisa las marcas del modelo (piezasCasa lo hace) y solo llega
#     el nivel alto. Sirve para piezas sueltas del kit (farol, fuente, puesto), no para sustituir una casa entera.
# Para ver el pueblo como antes: /mundo/?sinEdificios (casas del kit).
# ═══════════════════════════════════════════════════════
import math
import numpy as np
from mathutils.bvhtree import BVHTree
from dq_lib import *
import dq_lib as dq

PIEDRA = ['#9d978c', '#918c82', '#aaa498', '#989288']
CIMIENTO = '#857f76'
YESO = '#cfc2a3'
YESO2 = '#bfb295'
VIGA = '#4a382a'
TABLA = '#6e553c'
TEJA = '#96472b'
TEJA2 = '#84402a'
PIZARRA = '#5b5a68'
PAJA = '#a08a52'
HIERRO = '#2e2e33'
BRONCE = '#8a6a2e'
BARRO = '#8a5a3c'
MUSGO = '#34421f'
LUZ = ['#ffb45a', '#ff9a3c', '#ffc46e']
APAGADA = '#2a2018'
VIOLETA = '#a47cf5'
VERDE = '#3fd6b4'
BRASA = '#ff8a2c'
HONDO = -0.4
Z3 = np.array([0.0, 0.0, 1.0])


def _normal(p):
    n = np.zeros(3)
    for i in range(len(p)):
        a = p[i]; b = p[(i + 1) % len(p)]
        n += np.array([(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])])
    return n


def _col(c):
    return hexlin(c) if isinstance(c, str) else np.asarray(c, dtype=float)


class Obra:
    """Acumula piezas (vertices, caras, marca por cara, color por vertice) y al final hace UNA malla."""
    def __init__(s, lod, semilla=1):
        s.lod = lod; s.V = []; s.F = []; s.M = []; s.C = []; s.rng = azar(semilla); s.humo = []; s.fuego = []; s.luces = []

    def pieza(s, verts, caras, marca, color, dentro=None, hacia=None, ref=None):
        """dentro: punto interior (las caras miran hacia fuera de el). hacia: vector al que miran. ref(centro) → vector."""
        V = np.asarray(verts, dtype=float); base = len(s.V); col = _col(color)
        cols = np.tile(col, (len(V), 1)) if col.ndim == 1 else col
        for f in caras:
            f = list(f); p = V[f]; n = _normal(p); c = p.mean(0)
            r = (c - np.asarray(dentro, dtype=float)) if dentro is not None else (hacia if hacia is not None else (ref(c) if ref else None))
            if r is not None and np.dot(n, r) < 0: f.reverse()
            s.F.append(tuple(base + i for i in f)); s.M.append(marca)
        s.V.extend(V.tolist()); s.C.extend(np.asarray(cols).tolist())

    def caja(s, c, t, marca, color, R=None, sin=''):
        """Caja de centro c y tamaño t. R: matriz 3×3 (columnas = ejes locales). sin: caras que no se ponen
        ('x' = la de -X local, 'X' = la de +X, 'y', 'Y', 'z', 'Z')."""
        h = np.asarray(t, dtype=float) / 2
        P = np.array([[sx, sy, sz] for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)], dtype=float) * h
        if R is not None: P = P @ np.asarray(R, dtype=float).T
        caras = {'x': (0, 1, 3, 2), 'X': (4, 6, 7, 5), 'y': (0, 4, 5, 1), 'Y': (2, 3, 7, 6), 'z': (0, 2, 6, 4), 'Z': (1, 5, 7, 3)}
        s.pieza(P + np.asarray(c, dtype=float), [f for k, f in caras.items() if k not in sin], marca, color, dentro=c)

    def rejilla(s, fn, nu, nv, marca, color, hacia=None, dentro=None, colfn=None):
        """Superficie fn(a, b) → punto, con a y b en 0..1, en nu × nv cuadros."""
        nu = max(1, int(nu)); nv = max(1, int(nv)); V = []; F = []
        for j in range(nv + 1):
            for i in range(nu + 1): V.append(fn(i / nu, j / nv))
        for j in range(nv):
            for i in range(nu):
                a = j * (nu + 1) + i; F.append((a, a + 1, a + nu + 2, a + nu + 1))
        col = _col(color)
        if colfn is not None: col = np.array([col * colfn(i / nu, j / nv) for j in range(nv + 1) for i in range(nu + 1)])
        s.pieza(V, F, marca, col, dentro=dentro, hacia=hacia)

    def torno(s, perfil, lados, c, marca, color, ang0=0.0, tapa=True, base=False, ex=1.0, ey=1.0):
        """Figura de revolucion alrededor de un eje vertical en c: perfil = [(radio, z)] de abajo arriba."""
        c = np.asarray(c, dtype=float); V = []; F = []; n = len(perfil)
        for (r, z) in perfil:
            for k in range(lados):
                a = ang0 + 2 * math.pi * k / lados
                V.append(c + [math.cos(a) * max(r, 0.001) * ex, math.sin(a) * max(r, 0.001) * ey, z])
        for i in range(n - 1):
            for k in range(lados):
                a = i * lados + k; b = i * lados + (k + 1) % lados
                F.append((a, b, b + lados, a + lados))
        s.pieza(V, F, marca, color, ref=lambda q: np.array([q[0] - c[0], q[1] - c[1], 0.0]) + (q - c) * 0.02)
        if tapa: s.pieza(V[(n - 1) * lados:], [tuple(range(lados))], marca, color, hacia=Z3)
        if base: s.pieza(V[:lados], [tuple(range(lados))], marca, color, hacia=-Z3)

    def tris(s):
        return sum(len(f) - 2 for f in s.F)

    def objeto(s, nombre):
        o = malla(nombre, s.V, s.F, 'liso', '#888888')
        me = o.data; marcas = []
        for m in s.M:
            if m not in marcas: marcas.append(m)
        me.materials.clear()
        for m in marcas: me.materials.append(dq._mat(m))
        me.polygons.foreach_set('material_index', np.array([marcas.index(m) for m in s.M], dtype=np.int32))
        poner_color(o, np.array(s.C)); me.update()
        return o


class Cara:
    """Una pared vista desde fuera: origen o (x, y) en su esquina izquierda, u hacia la derecha, n hacia fuera."""
    def __init__(s, o, u, largo):
        s.o = np.array([o[0], o[1], 0.0]); s.u = np.array([u[0], u[1], 0.0]); s.n = np.array([u[1], -u[0], 0.0]); s.L = largo
        s.R = np.stack([s.u, s.n, Z3], axis=1)

    def p(s, u, z, fuera=0.0):
        return s.o + s.u * u + s.n * fuera + Z3 * z

    def caja(s, G, u0, u1, z0, z1, f0, f1, marca, color, sin='y'):
        G.caja(s.p((u0 + u1) / 2, (z0 + z1) / 2, (f0 + f1) / 2), (abs(u1 - u0), abs(f1 - f0), abs(z1 - z0)), marca, color, s.R, sin)

    def quad(s, G, u0, u1, z0, z1, fuera, marca, color, nu=1, nv=1):
        G.rejilla(lambda a, b: s.p(u0 + (u1 - u0) * a, z0 + (z1 - z0) * b, fuera), nu, nv, marca, color, hacia=s.n)

    def poli(s, G, pts, fuera, marca, color):
        G.pieza([s.p(u, z, fuera) for u, z in pts], [tuple(range(len(pts)))], marca, color, hacia=s.n)

    def barra(s, G, u0, z0, u1, z1, ancho, f0, f1, marca, color):
        """Viga inclinada dentro del plano de la pared, de (u0, z0) a (u1, z1)."""
        d = np.array([u1 - u0, z1 - z0]); L = float(np.linalg.norm(d)); d /= L
        a = s.u * d[0] + Z3 * d[1]; q = -s.u * d[1] + Z3 * d[0]
        G.caja(s.p((u0 + u1) / 2, (z0 + z1) / 2, (f0 + f1) / 2), (L, abs(f1 - f0), ancho), marca, color, np.stack([a, s.n, q], axis=1), 'y')


def caras(x0, x1, y0, y1):
    """Las cuatro paredes de un rectangulo: F (frente, -Y), D (derecha, +X), T (trasera), I (izquierda)."""
    return {'F': Cara((x0, y0), (1, 0), x1 - x0), 'D': Cara((x1, y0), (0, 1), y1 - y0), 'T': Cara((x1, y1), (-1, 0), x1 - x0), 'I': Cara((x0, y1), (0, -1), y1 - y0)}


# ── piezas de obra ──
def viga(G, ca, u0, u1, z0, z1, fuera=0.05, color=VIGA, clave=False):
    """Madero sobre la pared: caja de cerca, un cuadro a media distancia y, de lejos, solo los principales."""
    if G.lod == 0: ca.caja(G, u0, u1, z0, z1, 0, fuera, 'madera', color)
    elif G.lod == 1 or clave: ca.quad(G, u0, u1, z0, z1, fuera * 0.6, 'madera', color)


def muro(G, ca, z0, z1, marca='piedra', color=PIEDRA[0], u0=0.0, u1=None, fuera=0.0, paso=1.4):
    u1 = ca.L if u1 is None else u1
    k = (paso, 3.0, 99)[G.lod]
    ca.quad(G, u0, u1, z0, z1, fuera, marca, color, math.ceil((u1 - u0) / k), math.ceil((z1 - z0) / k))


def contraventanas(G, ca, u0, u1, z0, z1, color, fuera=0.03, lados=(1, 1)):
    if G.lod == 2: return
    an = min(0.5, (u1 - u0) * 0.52)
    for s, ok in ((-1, lados[0]), (1, lados[1])):
        if not ok: continue
        a = u0 - an - 0.03 if s < 0 else u1 + 0.03
        if G.lod == 0:
            ca.caja(G, a, a + an, z0 - 0.03, z1 + 0.03, fuera, fuera + 0.045, 'puerta', color)
            for zz in (z0 + (z1 - z0) * 0.2, z0 + (z1 - z0) * 0.8): ca.quad(G, a + 0.02, a + an - 0.02, zz - 0.035, zz + 0.035, fuera + 0.055, 'liso', HIERRO)
        else: ca.quad(G, a, a + an, z0, z1, fuera + 0.03, 'puerta', color)


def vidrio(G, ca, u0, u1, z0, z1, luz, fuera=0.02, punta=0.0):
    """Vidriera (el plomo lo dibuja el juego). luz: color, o None si esta a oscuras. punta: remate en pico."""
    c = luz or APAGADA
    if luz: G.luces.append((ca.p((u0 + u1) / 2, (z0 + z1) / 2, 0.3), (u1 - u0) * (z1 - z0), luz))
    if punta: ca.poli(G, [(u0, z0), (u1, z0), (u1, z1 - punta), ((u0 + u1) / 2, z1), (u0, z1 - punta)], fuera, 'vidrio', c)
    else: ca.quad(G, u0, u1, z0, z1, fuera, 'vidrio', c)


def ventana(G, ca, u, z, an, al, luz, contras=VIGA, marco='piedra', punta=0.0, lados=(1, 1)):
    """Ventana sobre un muro de piedra: dintel y alfeizar de piedra, jambas de madera, contraventanas."""
    u0 = u - an / 2; u1 = u + an / 2; z1 = z + al
    vidrio(G, ca, u0, u1, z, z1, luz, 0.02, punta)
    if G.lod == 2: return
    if G.lod == 0:
        ca.caja(G, u0 - 0.16, u1 + 0.16, z - 0.16, z, 0, 0.13, 'piedra', PIEDRA[2])
        if punta:
            ca.barra(G, u0 - 0.06, z1 - punta, u, z1 + 0.08, 0.14, 0, 0.09, 'piedra', PIEDRA[2]); ca.barra(G, u, z1 + 0.08, u1 + 0.06, z1 - punta, 0.14, 0, 0.09, 'piedra', PIEDRA[2])
        else: ca.caja(G, u0 - 0.2, u1 + 0.2, z1, z1 + 0.2, 0, 0.09, marco, PIEDRA[2] if marco == 'piedra' else VIGA)
        for a in (u0 - 0.07, u1): ca.caja(G, a, a + 0.07, z, z1 - punta, 0, 0.06, 'madera', VIGA)
        if an > 0.75 and not punta: ca.caja(G, u - 0.03, u + 0.03, z, z1, 0.02, 0.05, 'madera', VIGA, 'yzZ')
    else:
        ca.quad(G, u0 - 0.14, u1 + 0.14, z - 0.14, z, 0.05, 'piedra', PIEDRA[2])
        if not punta: ca.quad(G, u0 - 0.14, u1 + 0.14, z1, z1 + 0.16, 0.05, marco, PIEDRA[2] if marco == 'piedra' else VIGA)
    if contras: contraventanas(G, ca, u0 - 0.07, u1 + 0.07, z, z1, contras, 0.03, lados)


def arco(G, ca, uc, z, radio, n, grosor, fuera, marca='piedra', a0=0.0, a1=math.pi):
    """Dovelas en arco (de a0 a a1) sobre la pared, con centro en (uc, z)."""
    for k in range(n):
        a = a0 + (k + 0.5) / n * (a1 - a0); r = radio + grosor / 2; cl = (k == n // 2 and n % 2 == 1)
        tg = -ca.u * math.sin(a) + Z3 * math.cos(a); rd = ca.u * math.cos(a) + Z3 * math.sin(a)
        L = (a1 - a0) / n * (radio + grosor) * 1.02
        G.caja(ca.p(uc + math.cos(a) * r, z + math.sin(a) * r, fuera / 2 * (1.25 if cl else 1)), (L, fuera * (1.25 if cl else 1), grosor * (1.2 if cl else 1)), marca, PIEDRA[(k * 3) % 4], np.stack([tg, ca.n, rd], axis=1), 'y')


def puerta(G, ca, u, z0, an, al, arq=False, doble=False, marco='madera', color=TABLA, peldano=True):
    """Puerta de tablas con herrajes; jambas y dintel (o arco de dovelas) y peldaño de piedra."""
    u0 = u - an / 2; u1 = u + an / 2
    if arq:
        r = an / 2; n = (7, 4, 2)[G.lod]
        pts = [(u0, z0), (u1, z0)] + [(u + math.cos(a) * r, z0 + al - r + math.sin(a) * r) for a in np.linspace(0, math.pi, n + 1)]
        ca.poli(G, pts, 0.04, 'puerta', color)
    else: ca.quad(G, u0, u1, z0, z0 + al, 0.04, 'puerta', color)
    if G.lod == 2: return
    mc = PIEDRA[2] if marco == 'piedra' else VIGA
    if G.lod == 0:
        for a in (u0 - 0.2, u1): ca.caja(G, a, a + 0.2, z0, z0 + al - (an / 2 if arq else 0), 0, 0.14, marco, mc)
        if arq: arco(G, ca, u, z0 + al - an / 2, an / 2, 7, 0.3, 0.16)
        else: ca.caja(G, u0 - 0.32, u1 + 0.32, z0 + al, z0 + al + 0.26, 0, 0.16, marco, mc)
        # Herrajes: tres bisagras largas por hoja, con la punta ensanchada, y la argolla.
        hojas = [(u0, 1), (u1, -1)] if doble else [(u0, 1)]
        largo = an * (0.38 if doble else 0.68)
        for (a, sg) in hojas:
            for zz in (z0 + al * 0.16, z0 + al * 0.48, z0 + al * (0.72 if arq else 0.82)):
                ca.quad(G, min(a, a + sg * largo), max(a, a + sg * largo), zz - 0.04, zz + 0.04, 0.055, 'liso', HIERRO)
                e = a + sg * largo; ca.poli(G, [(e, zz - 0.09), (e + sg * 0.12, zz), (e, zz + 0.09)] if sg > 0 else [(e, zz - 0.09), (e, zz + 0.09), (e + sg * 0.12, zz)], 0.055, 'liso', HIERRO)
        ua = u1 - 0.22 if not doble else u + 0.14
        G.torno([(0.085, -0.02), (0.085, 0.02)], 8, ca.p(ua, z0 + al * 0.47, 0.075), 'liso', HIERRO, tapa=False)
        ca.caja(G, ua - 0.035, ua + 0.035, z0 + al * 0.47 + 0.06, z0 + al * 0.47 + 0.13, 0.04, 0.09, 'liso', HIERRO)
        if doble: ca.quad(G, u - 0.02, u + 0.02, z0, z0 + al - (0.1 if arq else 0), 0.05, 'liso', '#241b14')
    else:
        ca.quad(G, u0 - 0.2, u0, z0, z0 + al, 0.08, marco, mc); ca.quad(G, u1, u1 + 0.2, z0, z0 + al, 0.08, marco, mc)
        ca.quad(G, u0 - 0.3, u1 + 0.3, z0 + al - (0.0 if not arq else 0.1), z0 + al + 0.26, 0.09, marco, mc)
    if peldano: ca.caja(G, u0 - 0.3, u1 + 0.3, HONDO, z0, 0, 0.55, 'piedra', PIEDRA[1], 'yz')


def antorcha(G, ca, u, z):
    """Antorcha de pared: brazo de hierro, palo y brasa. El juego le pone la llama (sus['fuego'])."""
    if G.lod < 2:
        ca.caja(G, u - 0.03, u + 0.03, z - 0.05, z + 0.02, 0, 0.3, 'liso', HIERRO)
        ca.caja(G, u - 0.045, u + 0.045, z - 0.3, z + 0.3, 0.26, 0.35, 'puerta', TABLA, '')
        ca.caja(G, u - 0.085, u + 0.085, z + 0.24, z + 0.36, 0.22, 0.39, 'liso', HIERRO, '')
    if G.lod == 0: G.torno([(0.075, 0.0), (0.02, 0.22)], 5, ca.p(u, z + 0.36, 0.305), 'emisivo', BRASA)
    else: ca.caja(G, u - 0.06, u + 0.06, z + 0.36, z + 0.52, 0.25, 0.37, 'emisivo', BRASA, 'z')
    G.fuego.append((ca.p(u, z + 0.62, 0.305), 0.55))


def entramado(G, ca, z0, z1, n, vent=None, riostras=(), fuera=0.0, yeso=YESO, contras=TABLA, puerta_en=None, travesano=True):
    """Pared de entramado: pies derechos cada L/n, soleras, riostras en diagonal y paños de yeso ENTRE los maderos.
    vent: {columna: color de luz | None (a oscuras)}; riostras: columnas con diagonal ('/' o '\\' segun el signo)."""
    vent = vent or {}; L = ca.L; sw = 0.17; rh = 0.2; f = fuera
    us = [i * L / n for i in range(n + 1)]
    viga(G, ca, 0, L, z0, z0 + rh, f + 0.07, clave=True); viga(G, ca, 0, L, z1 - rh, z1, f + 0.07, clave=True)
    for i, u in enumerate(us):
        a = 0 if i == 0 else (L - sw if i == n else u - sw / 2)
        viga(G, ca, a, a + sw, z0 + rh, z1 - rh, f + 0.05, clave=(i == 0 or i == n))
    if G.lod == 2:
        ca.quad(G, 0, L, z0, z1, f, 'liso', yeso)
        for i in vent:
            if vent[i]: ca.quad(G, us[i] + sw, us[i + 1] - sw, z0 + rh + 0.8, z1 - rh - 0.25, f + 0.03, 'vidrio', vent[i])
        return
    za = z0 + rh; zb = z1 - rh
    for i in range(n):
        a = (sw if i == 0 else us[i] + sw / 2); b = (L - sw if i == n - 1 else us[i + 1] - sw / 2)
        if puerta_en is not None and i == puerta_en: continue
        if i in vent:
            zs = za + min(0.8, (zb - za) * 0.36); zh = zb - 0.22
            ca.quad(G, a, b, za, zs, f, 'liso', yeso); ca.quad(G, a, b, zh, zb, f, 'liso', yeso)
            vidrio(G, ca, a, b, zs, zh, vent[i], f + 0.005)
            viga(G, ca, a, b, zs - 0.12, zs, f + 0.075); viga(G, ca, a, b, zh, zh + 0.1, f + 0.06)
            if G.lod == 0 and b - a > 0.7: ca.caja(G, (a + b) / 2 - 0.025, (a + b) / 2 + 0.025, zs, zh, f, f + 0.04, 'madera', VIGA, 'yzZ')
            if contras: contraventanas(G, ca, a - sw, b + sw, zs, zh, contras, f + 0.055, ((i - 1) not in vent and i > 0, (i + 1) not in vent and i < n - 1))
            continue
        ca.quad(G, a, b, za, zb, f, 'liso', yeso, 1, 2 if G.lod == 0 else 1)
        r = [x for x in riostras if abs(x) - 1 == i]
        if r and G.lod == 0:
            if r[0] > 0: ca.barra(G, a, za, b, zb, 0.15, f, f + 0.045, 'madera', VIGA)
            else: ca.barra(G, a, zb, b, za, 0.15, f, f + 0.045, 'madera', VIGA)
        elif travesano and G.lod == 0 and (i % 2 == 1): viga(G, ca, a, b, (za + zb) / 2 - 0.07, (za + zb) / 2 + 0.07, f + 0.045)


def faldon(G, E0, E1, C0, C1, color, nh=None, ns=None, paso=0.05, pandeo=0.0, borde=0.05, semilla=0):
    """Un faldon de tejado en hiladas solapadas: de la linea del alero (E0→E1) a la cumbrera (C0→C1).
    Cada hilada levanta su borde de abajo sobre la anterior; los vertices bailan un poco (tejas irregulares)."""
    E0, E1, C0, C1 = [np.asarray(x, dtype=float) for x in (E0, E1, C0, C1)]
    largo = float(np.linalg.norm(E1 - E0)); cae = float(np.linalg.norm((C0 + C1) / 2 - (E0 + E1) / 2))
    nh = nh or (max(3, round(cae / 0.62)), 4, 1)[G.lod]; ns = ns or (max(2, round(largo / 0.95)), 3, 1)[G.lod]
    nrm = np.cross(E1 - E0, C0 - E0); nrm /= np.linalg.norm(nrm)
    if nrm[2] < 0: nrm = -nrm
    rng = azar(semilla + 77); base = _col(color); pico = np.linalg.norm(C1 - C0) < 1e-6
    sube = ((C0 + C1) / 2 - (E0 + E1) / 2) / cae
    def punto(s, t):
        e = E0 + (E1 - E0) * s; c = C0 + (C1 - C0) * s
        return e + (c - e) * t - Z3 * pandeo * 4 * s * (1 - s) * (0.35 + 0.65 * t)
    for k in range(nh):
        t0 = k / nh; t1 = min(1.0, (k + 1.6) / nh) if G.lod < 2 else 1.0   # se mete bien debajo de la siguiente: no se ve hueco ni a contraluz
        tono = 1 + rng.uniform(-0.1, 0.1)
        V = []; C = []; pie = []
        for j in range(ns + 1):
            s = j / ns
            jit = (rng.uniform(-1, 1) if G.lod < 2 else 0.0)
            lev = paso * (1 + 0.5 * rng.uniform(-1, 1)) if G.lod < 2 else 0.0
            V.append(punto(s, t0) + nrm * (lev if k or G.lod < 2 else 0) - sube * (borde * jit if k == 0 else borde * 0.6 * jit))
            V.append(punto(s, t1) + nrm * (0.0 if k < nh - 1 else paso * 0.4))
            pie.append(V[-2] - nrm * (lev + 0.02) + sube * 0.03)
            m = tono * (1 + rng.uniform(-0.13, 0.13)); C.append(base * m * 1.06); C.append(base * m * 0.86)
        F = [(2 * j, 2 * j + 2, 2 * j + 3, 2 * j + 1) for j in range(ns)]
        if pico and k == nh - 1: F = [(2 * j, 2 * j + 2, 2 * j + 1) for j in range(ns)]
        G.pieza(V, F, 'teja', np.array(C), hacia=nrm)
        if G.lod == 0 and paso >= 0.08:   # canto grueso (paja): se ve el espesor de cada capa
            G.pieza([V[2 * j] for j in range(ns + 1)] + pie, [(j, j + 1, ns + 2 + j, ns + 1 + j) for j in range(ns)], 'teja', np.array([C[2 * j] * 0.6 for j in range(ns + 1)] * 2), hacia=-sube)
    return nrm


def tejado(G, x0, x1, y0, y1, z0, pend=50, eje='x', color=TEJA, alero=0.45, vuelo=0.35, pandeo=0.1, hastial='entramado', semilla=0, paso=0.05, grueso=0.1, yeso=YESO, luz_hastial=None):
    """Tejado a dos aguas con alero, cumbrera con caballete, tablas de borde y hastiales.
    hastial: 'entramado', 'piedra' o 'escalonado' (piñon de piedra en escalera, sin vuelo). Devuelve alto(x, y)."""
    T = (lambda a, b, z: np.array([a, b, z])) if eje == 'x' else (lambda a, b, z: np.array([b, a, z]))
    a0, a1, b0, b1 = (x0, x1, y0, y1) if eje == 'x' else (y0, y1, x0, x1)
    S = (b1 - b0) / 2; bc = (b0 + b1) / 2; tg = math.tan(math.radians(pend)); alto = S * tg
    if hastial == 'escalonado': vuelo = -0.25
    ze = z0 - alero * tg; zc = z0 + alto
    for sg in (-1, 1):
        be = bc + sg * (S + alero)
        faldon(G, T(a0 - vuelo, be, ze), T(a1 + vuelo, be, ze), T(a0 - vuelo, bc, zc), T(a1 + vuelo, bc, zc), color, pandeo=pandeo, semilla=semilla + (sg > 0), paso=paso)
        nrm = np.array(T(0, sg * tg, 1.0)); nrm /= np.linalg.norm(nrm)
        if G.lod < 2:
            # Sofito (madera vista por debajo del alero) y tabla del canto.
            g = nrm * grueso
            G.pieza([T(a0 - vuelo, be, ze) - g, T(a1 + vuelo, be, ze) - g, T(a1 + vuelo, bc + sg * (S - 0.1), z0 - 0.1 * tg) - g, T(a0 - vuelo, bc + sg * (S - 0.1), z0 - 0.1 * tg) - g], [(0, 1, 2, 3)], 'madera', VIGA, hacia=-nrm)
            G.pieza([T(a0 - vuelo, be, ze) - g, T(a1 + vuelo, be, ze) - g, T(a1 + vuelo, be, ze) + nrm * 0.04, T(a0 - vuelo, be, ze) + nrm * 0.04], [(0, 1, 2, 3)], 'madera', VIGA, hacia=np.array(T(0, sg, 0)))
        if G.lod < 2 and hastial != 'escalonado':
            # Tablas de borde del hastial, siguiendo la pendiente.
            for a, sa in ((a0 - vuelo, -1), (a1 + vuelo, 1)):
                p0 = T(a, be, ze); p1 = T(a, bc, zc + 0.02); d = p1 - p0; L = float(np.linalg.norm(d)); d /= L
                R = np.stack([d, np.array(T(1.0, 0, 0)), nrm], axis=1)
                if G.lod == 0: G.caja((p0 + p1) / 2 - nrm * 0.07 - d * 0.06, (L + 0.12, 0.07, 0.26), 'madera', VIGA, R)
                else: G.pieza([p0 - nrm * 0.2, p1 - nrm * 0.2, p1 + nrm * 0.05, p0 + nrm * 0.05], [(0, 1, 2, 3)], 'madera', VIGA, hacia=np.array(T(sa, 0, 0)))
    # Caballete: tejas a horcajadas sobre la cumbrera, por tramos.
    if G.lod < 2:
        n = max(2, round((a1 - a0 + 2 * vuelo) / 1.1)) if G.lod == 0 else 2; rng = azar(semilla + 5)
        for i in range(n):
            s0 = i / n; s1 = (i + 1.06) / n
            def pc(s, off, dz):
                a = a0 - vuelo + (a1 - a0 + 2 * vuelo) * min(s, 1.0)
                return T(a, bc + off, zc + dz - pandeo * 4 * min(s, 1.0) * (1 - min(s, 1.0)))
            j = rng.uniform(-0.02, 0.02)
            V = [pc(s0, -0.24, -0.2), pc(s0, 0, 0.13 + j), pc(s0, 0.24, -0.2), pc(s1, -0.22, -0.22), pc(s1, 0, 0.09 + j), pc(s1, 0.22, -0.22)]
            G.pieza(V, [(0, 1, 4, 3), (1, 2, 5, 4)], 'teja', _col(color) * rng.uniform(0.7, 0.95), dentro=pc((s0 + s1) / 2, 0, -1.0))
    # Hastiales.
    cs = caras(x0, x1, y0, y1)
    for ca in ((cs['I'], cs['D']) if eje == 'x' else (cs['F'], cs['T'])):
        if hastial == 'entramado':
            pts = [(0, z0), (2 * S, z0), (S, zc)]
            if G.lod == 0:
                zt = z0 + alto * 0.5; w = S * 0.5
                ca.poli(G, [(0.17, z0 + 0.2), (S - 0.085, z0 + 0.2), (S - 0.085, zt - 0.07), (w, zt - 0.07)], 0, 'liso', yeso)
                ca.poli(G, [(S + 0.085, z0 + 0.2), (2 * S - 0.17, z0 + 0.2), (2 * S - w, zt - 0.07), (S + 0.085, zt - 0.07)], 0, 'liso', yeso)
                if luz_hastial is not None:
                    vidrio(G, ca, S - 0.42, S + 0.42, zt + 0.25, zt + 1.15, luz_hastial or None, 0.01)
                    ca.poli(G, [(w + 0.12, zt + 0.07), (S - 0.42, zt + 0.07), (S - 0.42, zt + 1.15), (S, zt + 1.15), (S, zc - 0.2)], 0, 'liso', yeso)
                    ca.poli(G, [(S + 0.42, zt + 0.07), (2 * S - w - 0.12, zt + 0.07), (S, zc - 0.2), (S, zt + 1.15), (S + 0.42, zt + 1.15)], 0, 'liso', yeso)
                    ca.quad(G, S - 0.42, S + 0.42, zt + 0.07, zt + 0.25, 0, 'liso', yeso)
                    viga(G, ca, S - 0.5, S + 0.5, zt + 0.17, zt + 0.25, 0.07); viga(G, ca, S - 0.5, S + 0.5, zt + 1.15, zt + 1.24, 0.06)
                else:
                    ca.poli(G, [(w + 0.12, zt + 0.07), (2 * S - w - 0.12, zt + 0.07), (S, zc - 0.2)], 0, 'liso', yeso)
                    viga(G, ca, S - 0.085, S + 0.085, zt + 0.07, zc - 0.25, 0.05)
                viga(G, ca, 0, 2 * S, z0, z0 + 0.2, 0.07); viga(G, ca, S - 0.085, S + 0.085, z0 + 0.2, zt - 0.07, 0.05); viga(G, ca, w - 0.1, 2 * S - w + 0.1, zt - 0.07, zt + 0.07, 0.06)
                ca.barra(G, 0.02, z0 + 0.05, S, zc - 0.08, 0.2, 0, 0.05, 'madera', VIGA); ca.barra(G, S, zc - 0.08, 2 * S - 0.02, z0 + 0.05, 0.2, 0, 0.05, 'madera', VIGA)
            else:
                ca.poli(G, pts, 0, 'liso', yeso)
                if G.lod == 1: viga(G, ca, 0, 2 * S, z0, z0 + 0.2, 0.07); viga(G, ca, S - 0.085, S + 0.085, z0 + 0.2, zc - 0.3, 0.05)
                if luz_hastial: vidrio(G, ca, S - 0.42, S + 0.42, z0 + alto * 0.5 + 0.25, z0 + alto * 0.5 + 1.15, luz_hastial, 0.03)
        else:
            n = (3, 1, 1)[G.lod]
            G.rejilla(lambda u, v: ca.p(2 * S * (u * (1 - v) + 0.5 * v), z0 + alto * v), 2 * n, n, 'piedra', PIEDRA[0], hacia=ca.n)
            if luz_hastial is not None: ventana(G, ca, S, z0 + alto * 0.28, 0.6, 1.1, luz_hastial or None, contras=None, punta=0.3)
            if hastial == 'escalonado' and G.lod < 2:
                ne = (5, 3)[G.lod]
                for k in range(ne):
                    for sg in (-1, 1):
                        ub = S + sg * S * (1 - (k + 0.5) / (ne + 0.5)); an = S / (ne + 0.5) + 0.04; zt = z0 + alto * (k + 1) / (ne + 0.5) + 0.45
                        G.caja(ca.p(ub, (z0 + zt) / 2 - 0.2, -0.2), (an, 0.5, zt - z0 + 0.4), 'piedra', PIEDRA[(k + (sg > 0)) % 4], ca.R, 'z')
                        if G.lod == 0: G.caja(ca.p(ub, zt + 0.05, -0.2), (an + 0.1, 0.62, 0.1), 'piedra', PIEDRA[2], ca.R)
                G.caja(ca.p(S, z0 + alto / 2 + 0.3, -0.2), (S / (ne + 0.5) + 0.1, 0.5, alto + 0.9), 'piedra', PIEDRA[1], ca.R, 'z')
                if G.lod == 0: G.caja(ca.p(S, z0 + alto + 0.8, -0.2), (S / (ne + 0.5) + 0.22, 0.62, 0.1), 'piedra', PIEDRA[2], ca.R)
    def alto_en(x, y):
        b = y if eje == 'x' else x
        return z0 + alto - abs(b - bc) * tg
    return alto_en


def piramide(G, c, r, z0, alto, lados, color, ang0=0.0, alero=0.0, nh=None, paso=0.05, semilla=3):
    """Tejado de torre: piramide o chapitel de `lados` caras, en hiladas."""
    pts = [np.array([c[0] + math.cos(ang0 + 2 * math.pi * k / lados) * (r + alero), c[1] + math.sin(ang0 + 2 * math.pi * k / lados) * (r + alero), z0 - alero * alto / r]) for k in range(lados)]
    ap = np.array([c[0], c[1], z0 + alto])
    for k in range(lados):
        faldon(G, pts[k], pts[(k + 1) % lados], ap, ap, color, nh=nh or (max(3, round(alto / 0.8)), 2, 1)[G.lod], ns=1, paso=paso, borde=0.03, semilla=semilla + k)
    if G.lod < 2: G.pieza(pts + [np.array([c[0], c[1], z0 - alero * alto / r - 0.02])], [(k, (k + 1) % lados, lados) for k in range(lados)], 'madera', VIGA, hacia=-Z3)


def cimiento(G, x0, x1, y0, y1, alto=0.55, sale=0.12, color=CIMIENTO, hueco=None):
    """Zocalo de piedra que sobresale, con el canto de arriba en chaflan; baja bajo tierra.
    hueco: (pared, u0, u1) deja el paso de la puerta."""
    for k, ca in caras(x0, x1, y0, y1).items():
        tramos = [(-sale, ca.L + sale)]
        if hueco and hueco[0] == k: tramos = [(-sale, hueco[1]), (hueco[2], ca.L + sale)]
        for (ua, ub) in tramos:
            n = math.ceil((ub - ua) / (1.5, 4, 99)[G.lod]); e0 = sale if ua < 0 else 0.0; e1 = sale if ub > ca.L else 0.0
            G.rejilla(lambda a, b: ca.p(ua + (ub - ua) * a, HONDO + (alto - HONDO) * b, sale), n, 1, 'piedra', color, hacia=ca.n)
            if G.lod < 2: G.rejilla(lambda a, b: ca.p(ua + e0 * b + (ub - ua - (e0 + e1) * b) * a, alto + 0.1 * b, sale * (1 - b)), n, 1, 'piedra', PIEDRA[2], hacia=ca.n + Z3)
        if hueco and hueco[0] == k and G.lod < 2:
            for (uu, sg) in ((hueco[1], 1), (hueco[2], -1)):
                G.pieza([ca.p(uu, 0.0, 0), ca.p(uu, 0.0, sale), ca.p(uu, alto, sale), ca.p(uu, alto + 0.1, 0)], [(0, 1, 2, 3)], 'piedra', color, hacia=ca.u * sg)


def esquinales(G, x0, x1, y0, y1, z0, z1, alto=0.42):
    """Piedras de esquina alternas, algo salidas."""
    if G.lod: return
    n = int((z1 - z0) / alto)
    for (x, sx) in ((x0, -1), (x1, 1)):
        for (y, sy) in ((y0, -1), (y1, 1)):
            for k in range(n):
                lx, ly = (0.62, 0.36) if k % 2 else (0.36, 0.62)
                G.caja((x - sx * (lx / 2 - 0.04), y - sy * (ly / 2 - 0.04), z0 + (k + 0.5) * alto), (lx, ly, alto - 0.05), 'piedra', PIEDRA[2] if k % 2 else PIEDRA[0], None, ('X' if sx < 0 else 'x') + ('Y' if sy < 0 else 'y'))


def chimenea(G, x, y, z0, z1, sx=0.85, sy=0.85, color=PIEDRA[1], humo=True):
    """Chimenea de piedra con cornisa, losa y dos sombreretes de barro; el hollin lo pinta acabar()."""
    n = max(1, round((z1 - z0) / 1.2)) if G.lod == 0 else 1
    for ca in caras(x - sx / 2, x + sx / 2, y - sy / 2, y + sy / 2).values():
        G.rejilla(lambda a, b: ca.p(ca.L * a, z0 + (z1 - z0) * b, 0.03 * (1 - b)), 1, n, 'piedra', color, hacia=ca.n)
    if G.lod < 2: G.caja((x, y, z1 + 0.07), (sx + 0.22, sy + 0.22, 0.16), 'piedra', PIEDRA[2])
    else: G.caja((x, y, z1 + 0.05), (sx, sy, 0.1), 'piedra', PIEDRA[2], None, 'z')
    if G.lod == 0:
        for d in (-0.2, 0.2): G.torno([(0.15, 0.0), (0.12, 0.34), (0.15, 0.38)], 6, (x + d * (sx > sy), y + d * (sx <= sy), z1 + 0.15), 'liso', BARRO)
    elif G.lod == 1: G.caja((x, y, z1 + 0.3), (0.3, 0.3, 0.32), 'liso', BARRO, None, 'z')
    if humo: G.humo.append((x, y, z1 + 0.55))
    G.hollin = getattr(G, 'hollin', []) + [(x, y, z1)]


def barril(G, x, y, z=0.0, r=0.36, alto=0.95, tumbado=None):
    if G.lod == 2: return
    L = (8, 6)[G.lod]
    G.torno([(r * 0.82, 0.0), (r, alto * 0.3), (r, alto * 0.7), (r * 0.82, alto)], L, (x, y, z), 'puerta', TABLA, tapa=True)
    if G.lod == 0:
        for k in (0.16, 0.84): G.torno([(r * 0.93, alto * k - 0.04), (r * 0.93, alto * k + 0.04)], L, (x, y, z), 'liso', HIERRO, tapa=False)


def cartel(G, ca, u, z, fuera=1.15, tipo='jarra'):
    """Cartel colgante de un brazo de hierro: tabla de canto a la calle con un emblema pintado (jarra o yunque)."""
    if G.lod == 2: return
    ca.caja(G, u - 0.035, u + 0.035, z + 0.62, z + 0.69, 0, fuera, 'liso', HIERRO)
    if G.lod == 0: ca.barra(G, u - 0.02, z + 0.15, u + 0.02, z + 0.62, 0.05, 0.0, 0.05, 'liso', HIERRO)
    G.caja(ca.p(u, z + 0.22, fuera - 0.45), (0.05, 0.8, 0.66), 'puerta', TABLA, ca.R)
    if G.lod: return
    for a in (0.12, 0.78): ca.caja(G, u - 0.012, u + 0.012, z + 0.55, z + 0.63, fuera - a - 0.012, fuera - a + 0.012, 'liso', HIERRO, '')
    nn = (float(ca.n[0]), float(ca.n[1]))
    for c2 in (Cara(tuple((ca.p(u, 0, fuera - 0.05) + ca.u * 0.025)[:2]), (-nn[0], -nn[1]), 0.8), Cara(tuple((ca.p(u, 0, fuera - 0.85) - ca.u * 0.025)[:2]), nn, 0.8)):
        if tipo == 'jarra':
            c2.poli(G, [(0.27, z + 0.0), (0.5, z + 0.0), (0.53, z + 0.38), (0.24, z + 0.38)], 0.012, 'liso', '#c9a24a')
            c2.quad(G, 0.53, 0.63, z + 0.1, z + 0.3, 0.012, 'liso', '#c9a24a'); c2.quad(G, 0.24, 0.53, z + 0.38, z + 0.45, 0.014, 'liso', '#e8e0cc')
        else:
            c2.poli(G, [(0.2, z + 0.28), (0.62, z + 0.28), (0.7, z + 0.38), (0.14, z + 0.38)], 0.012, 'liso', '#8d8f96')
            c2.quad(G, 0.33, 0.5, z + 0.1, z + 0.28, 0.012, 'liso', '#8d8f96'); c2.quad(G, 0.25, 0.58, z + 0.0, z + 0.1, 0.012, 'liso', '#8d8f96')


def lenera(G, x0, x1, y, z=0.0, filas=3, eje='x'):
    """Monton de leña: troncos apilados (de cerca, uno a uno)."""
    if G.lod == 2: return
    if G.lod == 1:
        c = ((x0 + x1) / 2, y, z + filas * 0.11) if eje == 'x' else (y, (x0 + x1) / 2, z + filas * 0.11)
        G.caja(c, (x1 - x0, 0.6, filas * 0.22) if eje == 'x' else (0.6, x1 - x0, filas * 0.22), 'puerta', TABLA, None, 'z'); return
    n = int((x1 - x0) / 0.24); rng = azar(int(abs(x0 * 31 + y * 17)) + 3)
    for f in range(filas):
        for i in range(n - f):
            a = x0 + 0.12 + (i + f * 0.5) * 0.24; r = 0.11 * rng.uniform(0.85, 1.1); col = _col(TABLA) * rng.uniform(0.75, 1.25)
            pts = [(a, y - 0.3, z + 0.11 + f * 0.2), (a, y + 0.3, z + 0.11 + f * 0.2)] if eje == 'x' else [(y - 0.3, a, z + 0.11 + f * 0.2), (y + 0.3, a, z + 0.11 + f * 0.2)]
            d = np.array(pts[1]) - np.array(pts[0]); d /= np.linalg.norm(d); q = np.cross(d, Z3)
            V = [np.array(p) + (q * math.cos(t) + Z3 * math.sin(t)) * r for p in pts for t in np.linspace(0, 2 * math.pi, 6)[:-1]]
            G.pieza(V, [(k, (k + 1) % 5, 5 + (k + 1) % 5, 5 + k) for k in range(5)], 'puerta', col, ref=lambda c, p0=np.array(pts[0]), d=d: (c - p0) - d * np.dot(c - p0, d))
            G.pieza(V[:5], [tuple(range(5))], 'liso', '#a8875c', hacia=-d); G.pieza(V[5:], [tuple(range(5))], 'liso', '#a8875c', hacia=d)


def hiedra(G, ca, u, z0, ancho, alto, semilla=1, fuera=0.05):
    """Mata de hiedra trepando por la pared: una lamina pegada al muro, de borde roto, mas ancha abajo."""
    if G.lod == 2: return
    rng = azar(semilla); nu = (7, 3)[G.lod]; nv = (9, 4)[G.lod]; V = []; C = []; F = []
    for j in range(nv + 1):
        t = j / nv; an = ancho * (1 - 0.55 * t ** 1.4) * (1 + 0.25 * math.sin(t * 7 + semilla))
        cu = u + ancho * 0.22 * math.sin(t * 2.6 + semilla * 1.3)
        for i in range(nu + 1):
            V.append(ca.p(cu + an * (i / nu - 0.5) + rng.uniform(-0.09, 0.09), z0 + alto * t + rng.uniform(-0.1, 0.1) * (j > 0), fuera * rng.uniform(0.5, 1.3)))
            C.append(hexlin(('#2c3a1e', '#34421f', '#3d4a26', '#27331a')[int(rng.integers(0, 4))]) * rng.uniform(0.8, 1.25))
    for j in range(nv):
        for i in range(nu):
            borde = i == 0 or i == nu - 1 or j == nv - 1
            if rng.random() < (0.42 if borde else 0.08): continue
            a = j * (nu + 1) + i; F.append((a, a + 1, a + nu + 2, a + nu + 1))
    G.pieza(V, F, 'liso', np.array(C), hacia=ca.n)


# ── acabado: irregularidad, color y oclusion ──
def oclusion(obj, fuerza=0.8, dist=2.4, rayos=28, sep=0.1, semilla=1):
    """Oclusion ambiental por vertice (rayos contra el propio modelo y el suelo), saliendo `sep` de la cara."""
    me = obj.data; P = pos(obj); N = normales(obj)
    bvh = BVHTree.FromPolygons([tuple(p) for p in P], [tuple(p.vertices) for p in me.polygons])
    rng = azar(semilla); D = rng.normal(0, 1, (rayos, 3)); D /= np.linalg.norm(D, axis=1)[:, None]
    ao = np.ones(len(P))
    for i in range(len(P)):
        n = N[i]; o = P[i] + n * sep; tot = 0.0; occ = 0.0
        for d in D:
            c = float(d @ n)
            if c < 0: d = -d; c = -c
            if c < 0.1: continue
            tot += c
            h = bvh.ray_cast(o, d, dist)
            if h[0] is not None: occ += c * (1 - h[3] / dist) ** 0.5
            elif d[2] < -1e-3 and o[2] >= 0:
                t = -o[2] / d[2]
                if t < dist: occ += c * (1 - t / dist) ** 0.5
        ao[i] = 1 - occ / max(tot, 1e-6)
    return 1 - fuerza * (1 - ao)


def acabar(G, nombre, torcer=0.02, musgo=0.36, ao=0.68):
    """De las piezas a la malla: quita lo «perfecto», pinta manchas, humedad, musgo y hollin, y hornea la oclusion."""
    o = G.objeto(nombre); me = o.data
    P = pos(o); C = color_de(o); n = len(P)
    mv = np.zeros(n, dtype=np.int32)                         # marca de cada vertice (las piezas no comparten vertices entre marcas)
    for f, m in zip(G.F, G.M):
        for i in f: mv[i] = MARCAS[m]
    luz = (mv == MARCAS['vidrio']) | (mv == MARCAS['emisivo'])
    # Nada a plomo ni a escuadra: un ruido suave mueve los vertices (por posicion: no abre grietas entre piezas).
    if torcer:
        d = np.stack([ruido(P, 0.55, 11), ruido(P, 0.55, 23), ruido(P, 0.55, 37)], axis=1) * torcer * np.clip((P[:, 2:3] + 0.5) / 3.0, 0.25, 1.6)
        P = P + d; poner_pos(o, P)
    r1 = ruido_fbm(P, 0.35, 3, 3); r2 = ruido_fbm(P, 1.7, 9, 2)
    k = (1 + r1 * 0.22 + r2 * 0.1)[:, None]
    C2 = C * k
    # Humedad y tierra al pie; musgo en piedra y teja (mas donde el ruido lo junta); desteñido arriba.
    pie = np.clip((0.9 - P[:, 2]) / 1.3, 0, 1) * (0.6 + 0.4 * r2)
    C2 *= (1 - 0.38 * pie)[:, None]
    pt = (mv == MARCAS['piedra']) | (mv == MARCAS['teja']) | (mv == MARCAS['monolito'])
    km = np.clip((ruido_fbm(P, 0.5, 21, 3) * 1.6 + 0.12 + pie * 0.9 - 0.45) / 0.3, 0, 1) * musgo * pt
    C2 = C2 * (1 - km[:, None]) + hexlin(MUSGO) * (1 + 0.3 * r2[:, None]) * km[:, None]
    for (hx, hy, hz) in getattr(G, 'hollin', []):
        d = np.sqrt((P[:, 0] - hx) ** 2 + (P[:, 1] - hy) ** 2 + ((P[:, 2] - hz) * 0.8) ** 2)
        C2 *= (1 - 0.55 * np.clip(1 - d / 1.3, 0, 1))[:, None]
    C2[luz] = C[luz]
    if ao and G.lod < 2:
        poner_color(o, C2)
        A = oclusion(o, ao)
        A[luz] = 1.0
        C2 = C2 * A[:, None]
    elif ao:
        # De lejos, sin rayos: solo el oscurecido hacia el suelo y bajo el alero.
        C2[~luz] *= np.clip(0.62 + P[~luz, 2:3] * 0.09, 0.62, 0.92)
    poner_color(o, C2)
    # El juego los dibuja con sombreado plano (calcula la normal en el fragmento): exportar las normales fundidas
    # deja un vertice por punto en vez de uno por cara y el paquete pesa la mitad. En la foto, cantos vivos.
    return suavizar(o, 180 if dq.ESTRICTO[0] else 30)


# ── los edificios ──
def _luces(rng, n, p=0.62, colores=LUZ):
    """Para n ventanas: color de luz o None (a oscuras), con al menos una encendida."""
    r = [colores[int(rng.integers(0, len(colores)))] if rng.random() < p else None for _ in range(n)]
    if n and not any(r): r[0] = colores[0]
    return r


def _meta(G, sus):
    j = lambda p: [round(float(p[0]), 2), round(float(p[2]), 2), round(float(-p[1]), 2)]
    if G.lod == 0:
        sus['humo'] = [j(p) for p in G.humo]; sus['fuego'] = [j(p) + [t] for p, t in G.fuego]
        # Halo de luz de noche: las tres vidrieras encendidas mas grandes que no esten pegadas entre si.
        el = []
        for (p, a, c) in sorted(G.luces, key=lambda x: -x[1]):
            if len(el) < 3 and all(np.linalg.norm(p - q) > 3.5 for q, _ in el): el.append((p, c))
        sus['luz'] = [j(p) + [1 if c == VIOLETA else 0] for p, c in el]


def definir(nombre, sus, tris, fn, semilla=1, musgo=0.36):
    @modelo(nombre, sustituye=sus, tris=tris, ao=0, lods='propio')
    def _f(lod):
        G = Obra(lod, semilla)
        fn(G)
        _meta(G, sus)
        return acabar(G, nombre, musgo=musgo)
    return _f


def casa_entramado(G, w, d, h1=2.75, h2=2.55, vuelo_alto=0.32, techo=TEJA, yeso=YESO, contras='#4a3a2c', baja='piedra', nF=None, luz_h=True, pend=50, chim=(0.28, 0.3)):
    """Casa de dos plantas: baja de piedra (o entramado sobre zocalo alto), alta de entramado en voladizo."""
    rng = G.rng; x0, x1, y0, y1 = -w / 2, w / 2, -d / 2, d / 2
    B = caras(x0, x1, y0, y1)
    nF = nF or max(3, round(w / 1.45)); nD = max(3, round(d / 1.45))
    pc = nF // 2; up = (pc + 0.5) * w / nF
    cimiento(G, x0, x1, y0, y1, hueco=('F', up - 0.85, up + 0.85))
    if baja == 'piedra':
        for k, ca in B.items(): muro(G, ca, 0.5, h1, 'piedra', PIEDRA[0])
        esquinales(G, x0, x1, y0, y1, 0.6, h1 - 0.1)
        lf = _luces(rng, 6, 0.55)
        for u_, l in zip([w * 0.17, w * 0.83], lf[:2]):
            if abs(u_ - up) > 1.5: ventana(G, B['F'], u_, 1.15, 0.85, 1.05, l, contras)
        ventana(G, B['D'], d * 0.5, 1.15, 0.85, 1.05, lf[2], contras); ventana(G, B['I'], d * 0.3, 1.15, 0.85, 1.05, lf[3], contras)
        ventana(G, B['T'], w * 0.3, 1.15, 0.85, 1.05, lf[4], contras); ventana(G, B['T'], w * 0.72, 1.15, 0.85, 1.05, lf[5], contras)
        puerta(G, B['F'], up, 0.3, 1.25, 2.1, marco='madera')
    else:
        for k, ca in B.items():
            muro(G, ca, 0.5, 1.0, 'piedra', PIEDRA[3])
            n = nF if k in 'FT' else nD; l = _luces(rng, 2, 0.6)
            v = {1: l[0], n - 2: l[1]} if k != 'F' else {0: l[0], n - 1: l[1]}
            entramado(G, ca, 1.0, h1, n, v, (1, -n), 0.0, yeso, contras, puerta_en=pc if k == 'F' else None, travesano=False)
        puerta(G, B['F'], up, 0.3, w / nF - 0.2, 2.15, marco='madera')
    antorcha(G, B['F'], up + 1.15, 1.75)
    # Planta alta en voladizo (delante y detras), sobre cabezas de viga.
    v = vuelo_alto; A = caras(x0, x1, y0 - v, y1 + v); z1 = h1 + 0.24; z2 = z1 + h2
    if G.lod < 2:
        for ca, cb in ((B['F'], A['F']), (B['T'], A['T'])):
            ca.caja(G, -0.05, w + 0.05, h1, z1, 0, v + 0.02, 'madera', VIGA, 'yZ')
            if G.lod == 0:
                for i in range(nF + 1): ca.caja(G, min(max(i * w / nF - 0.09, 0), w - 0.18), min(max(i * w / nF - 0.09, 0), w - 0.18) + 0.18, h1 - 0.2, h1 + 0.02, 0, v + 0.1, 'madera', '#33261c')
    for k in 'DI': viga(G, B[k], 0, d, h1, z1, 0.07, clave=True)
    if G.lod == 2:
        for k in 'FT': A[k].quad(G, 0, w, h1, z1, 0, 'madera', VIGA)
    lu = _luces(rng, 8, 0.62)
    entramado(G, A['F'], z1, z2, nF, {1: lu[0], nF - 2: lu[1]} if nF >= 5 else {1: lu[0]}, (1, -nF), 0.0, yeso, contras)
    entramado(G, A['T'], z1, z2, nF, {nF // 2: lu[2]}, (1, -nF), 0.0, yeso, contras)
    for k, i in (('D', 3), ('I', 4)):
        entramado(G, A[k], z1, z2, nD + 1, {(nD + 1) // 2: lu[i]}, (1, -(nD + 1)), 0.0, yeso, contras)
    eje = 'x' if w >= d else 'y'
    alto_en = tejado(G, x0, x1, y0 - v, y1 + v, z2, pend, eje, techo, semilla=int(w * 10 + d), yeso=yeso, luz_hastial=(lu[5] or '') if luz_h else None)
    cx, cy = (x0 + w * chim[0], y0 + (d + 2 * v) * chim[1] - v) if eje == 'x' else (x0 + w * chim[1], y0 + d * chim[0])
    chimenea(G, cx, cy, alto_en(cx, cy) - 0.9, alto_en(0, 0) + 0.55)
    return B, A, alto_en


# 0 · Casa de entramado de dos plantas (10 × 8): baja de piedra, alta en voladizo.
def casa0(G):
    B, A, alto = casa_entramado(G, 10, 8)
    barril(G, -3.9, -4.42); barril(G, -3.1, -4.4, r=0.3, alto=0.8)


# 1 · Casa del mercader (9 × 9): entramado en las dos plantas sobre zocalo alto y cuerpo saliente al frente.
def casa1(G):
    w, d = 9, 9
    B, A, alto = casa_entramado(G, w, d, baja='entramado', techo=TEJA2, yeso=YESO2, contras='#3f4a3a', nF=6, luz_h=True, pend=48, chim=(0.74, 0.32))
    # Mirador con su propio hastial sobre la puerta (buhardilla grande al frente).
    z2 = 2.75 + 0.24 + 2.55; an = 3.0; y0 = -d / 2 - 0.32; fondo = 3.4
    ca = Cara((-an / 2, y0 - 0.02), (1, 0), an); rng = azar(8)
    tg = math.tan(math.radians(54)); zc = z2 + an / 2 * tg
    ca.poli(G, [(0.0, z2), (an, z2), (an / 2, zc)], 0.0, 'liso', YESO2)
    vidrio(G, ca, an / 2 - 0.45, an / 2 + 0.45, z2 + 0.45, z2 + 1.5, LUZ[0], 0.02)
    if G.lod < 2:
        viga(G, ca, an / 2 - 0.55, an / 2 + 0.55, z2 + 0.33, z2 + 0.45, 0.07); viga(G, ca, an / 2 - 0.55, an / 2 + 0.55, z2 + 1.5, z2 + 1.6, 0.06)
        viga(G, ca, an / 2 - 0.55, an / 2 - 0.45, z2 + 0.45, z2 + 1.5, 0.05); viga(G, ca, an / 2 + 0.45, an / 2 + 0.55, z2 + 0.45, z2 + 1.5, 0.05)
    if G.lod == 0:
        ca.barra(G, 0.02, z2 + 0.05, an / 2, zc - 0.08, 0.18, 0, 0.05, 'madera', VIGA); ca.barra(G, an / 2, zc - 0.08, an - 0.02, z2 + 0.05, 0.18, 0, 0.05, 'madera', VIGA)
    for sg in (-1, 1):
        E0 = (sg * (an / 2 + 0.35), y0 - 0.4, z2 - 0.35 * tg); E1 = (sg * (an / 2 + 0.35), y0 + fondo, z2 - 0.35 * tg)
        faldon(G, E0, E1, (0, y0 - 0.4, zc), (0, y0 + fondo, zc), TEJA2, ns=(3, 1, 1)[G.lod], semilla=40 + sg)
        if G.lod == 0:
            p0 = np.array(E0); p1 = np.array((0, y0 - 0.4, zc + 0.02)); dd = p1 - p0; L = float(np.linalg.norm(dd)); dd /= L; nn = np.cross(dd, [0, 1.0, 0]); nn = nn if nn[2] > 0 else -nn
            G.caja((p0 + p1) / 2 - nn * 0.07, (L + 0.1, 0.07, 0.24), 'madera', VIGA, np.stack([dd, np.array([0, 1.0, 0]), nn], axis=1))
    barril(G, 3.6, -4.95, r=0.33, alto=0.85)


# 6 · Casa de piedra (8 × 9): dos plantas de sillares, piñones escalonados y tejado de pizarra.
def casa_piedra(G):
    w, d = 8, 9; x0, x1, y0, y1 = -w / 2, w / 2, -d / 2, d / 2; rng = G.rng; h = 5.3
    cimiento(G, x0, x1, y0, y1, 0.7, 0.16, hueco=('F', w / 2 - 0.87, w / 2 + 0.87))
    B = caras(x0, x1, y0, y1)
    for ca in B.values(): muro(G, ca, 0.6, h, 'piedra', PIEDRA[3])
    esquinales(G, x0, x1, y0, y1, 0.8, h - 0.1, 0.44)
    if G.lod < 2:
        for ca in B.values(): ca.caja(G, -0.06, ca.L + 0.06, 2.78, 2.94, 0, 0.07, 'piedra', PIEDRA[2])   # imposta entre plantas
    l = _luces(rng, 10, 0.6); c = '#39434c'
    puerta(G, B['F'], w / 2, 0.3, 1.3, 2.3, arq=True, marco='piedra')
    antorcha(G, B['F'], w / 2 + 1.3, 1.8)
    ventana(G, B['F'], 1.5, 1.2, 0.8, 1.1, l[0], c); ventana(G, B['F'], w - 1.5, 1.2, 0.8, 1.1, l[1], c)
    ventana(G, B['F'], 1.7, 3.5, 0.8, 1.15, l[2], c); ventana(G, B['F'], w / 2, 3.5, 0.8, 1.15, l[3], c); ventana(G, B['F'], w - 1.7, 3.5, 0.8, 1.15, l[4], c)
    for k, i in (('D', 5), ('I', 7)):
        ventana(G, B[k], d * 0.3, 3.5, 0.8, 1.15, l[i], c); ventana(G, B[k], d * 0.7, 1.2, 0.8, 1.1, l[i + 1], c)
    ventana(G, B['T'], w / 2, 3.5, 0.8, 1.15, l[9], c)
    # Contrafuerte en el costado derecho.
    if G.lod < 2:
        ca = B['D']; G.pieza([ca.p(d * 0.52, HONDO, 0), ca.p(d * 0.52 + 0.8, HONDO, 0), ca.p(d * 0.52 + 0.8, 3.0, 0), ca.p(d * 0.52, 3.0, 0), ca.p(d * 0.52, HONDO, 0.75), ca.p(d * 0.52 + 0.8, HONDO, 0.75), ca.p(d * 0.52 + 0.8, 1.6, 0.6), ca.p(d * 0.52, 1.6, 0.6)],
                             [(4, 5, 6, 7), (7, 6, 2, 3), (0, 4, 7, 3), (1, 2, 6, 5)], 'piedra', PIEDRA[1], dentro=ca.p(d * 0.52 + 0.4, 1.0, 0.2))
    hiedra(G, B['I'], d * 0.52, 0.2, 2.6, 4.6, 4); hiedra(G, B['T'], w * 0.72, 0.2, 2.0, 3.2, 9)
    alto = tejado(G, x0, x1, y0, y1, h, 52, 'y', PIZARRA, alero=0.4, hastial='escalonado', semilla=61, pandeo=0.05, luz_hastial=l[6] or '')
    chimenea(G, x0 + 1.5, y1 - 2.6, alto(x0 + 1.5, 0) - 0.9, alto(0, 0) + 0.9, 0.95, 0.95)


# 4 · Taberna (12 × 8): la casa mas larga; baja de piedra con portalon, alta en voladizo, buhardillas y cartel.
def taberna(G):
    w, d = 12, 8
    B, A, alto = casa_entramado(G, w, d, h1=2.9, h2=2.5, techo=TEJA, yeso=YESO, contras='#5a2e2a', nF=8, luz_h=True, pend=48, chim=(0.88, 0.62))
    # (casa_entramado ya puso puerta sencilla: aqui se viste de portalon de taberna)
    ca = B['F']; up = (8 // 2 + 0.5) * w / 8
    cartel(G, ca, up - 1.6, 2.35, tipo='jarra')
    bx = up - w / 2
    barril(G, bx + 2.3, -4.42); barril(G, bx + 3.1, -4.4, r=0.32, alto=0.85)
    if G.lod < 2:   # banco junto a la puerta
        G.caja((bx - 3.3, -4.36, 0.47), (1.7, 0.42, 0.08), 'puerta', TABLA)
        for dx in (-0.7, 0.7): G.caja((bx - 3.3 + dx, -4.36, 0.2), (0.1, 0.36, 0.5), 'puerta', VIGA, None, 'Z')
    # Dos buhardillas con luz en el faldon del frente.
    z2 = 2.9 + 0.24 + 2.5; tg = math.tan(math.radians(48))
    for k, x in enumerate((-3.2, 2.2)):
        yb = -d / 2 - 0.32 + 1.0; zb = z2 + 1.0 * tg; an = 1.3
        c2 = Cara((x - an / 2, yb), (1, 0), an)
        if G.lod < 2:
            c2.quad(G, 0, an, zb - 0.2, zb + 1.0, 0, 'liso', YESO); c2.poli(G, [(0, zb + 1.0), (an, zb + 1.0), (an / 2, zb + 1.55)], 0, 'liso', YESO)
            for a in (0, an - 0.12): viga(G, c2, a, a + 0.12, zb - 0.2, zb + 1.0, 0.04)
            viga(G, c2, 0, an, zb + 0.92, zb + 1.02, 0.05)
            for sg in (-1, 1):
                G.pieza([(x + sg * an / 2, yb, zb - 0.2), (x + sg * an / 2, yb, zb + 1.0), (x + sg * an / 2, yb + 1.25, zb + 1.0)], [(0, 1, 2)], 'liso', YESO, hacia=np.array([sg, 0, 0.0]))
                faldon(G, (x + sg * (an / 2 + 0.2), yb - 0.22, zb + 0.82), (x + sg * (an / 2 + 0.2), yb + 1.9, zb + 0.82), (x, yb - 0.22, zb + 1.62), (x, yb + 1.9, zb + 1.62), TEJA, nh=2, ns=1, semilla=90 + k * 2 + sg)
        vidrio(G, c2, 0.2, an - 0.2, zb + 0.12, zb + 0.9, LUZ[k], 0.02)


# 2 · Herreria (11 × 8): casa de piedra de planta y media y, a su derecha, el cobertizo abierto de la fragua.
def herreria(G):
    w, d = 11, 8; x0, x1, y0, y1 = -w / 2, w / 2, -d / 2, d / 2; rng = G.rng; xm = 1.2; h = 3.3
    cimiento(G, x0, x1, y0, y1, 0.5, 0.14, hueco=('F', 2.2 - 0.85, 2.2 + 0.85))
    B = caras(x0, xm, y0, y1)
    for ca in B.values(): muro(G, ca, 0.45, h, 'piedra', PIEDRA[1])
    esquinales(G, x0, xm, y0, y1, 0.6, h - 0.1)
    l = _luces(rng, 5, 0.6); c = '#4a3a2c'
    puerta(G, B['F'], 2.2, 0.3, 1.25, 2.1, marco='piedra'); antorcha(G, B['F'], 0.95, 1.8)
    ventana(G, B['F'], 4.9, 1.2, 0.9, 1.05, l[0], c); ventana(G, B['I'], d * 0.35, 1.2, 0.85, 1.05, l[1], c); ventana(G, B['I'], d * 0.72, 1.2, 0.85, 1.05, l[2], c)
    ventana(G, B['T'], 2.0, 1.2, 0.85, 1.05, l[3], c); ventana(G, B['T'], 4.9, 1.2, 0.85, 1.05, l[4], c)
    cartel(G, B['F'], 3.7, 2.45, tipo='yunque')
    # Cobertizo: muro trasero y lateral bajos de piedra, postes y jabalcones de madera delante.
    T = caras(xm, x1, y0, y1)
    muro(G, T['T'], 0.45, h, 'piedra', PIEDRA[1]); muro(G, T['D'], 0.45, h, 'piedra', PIEDRA[1], u0=d * 0.45)
    if G.lod < 2:
        Ti = Cara((xm, y1 - 0.5), (1, 0), x1 - xm); muro(G, Ti, 0.0, h, 'piedra', PIEDRA[3])   # caras de dentro
        G.rejilla(lambda a, b: np.array([x1 - 0.5, y0 + d * 0.45 + d * 0.55 * a, h * b]), 2, 2, 'piedra', PIEDRA[3], hacia=np.array([-1.0, 0, 0]))
        G.rejilla(lambda a, b: np.array([x1 - 0.5 * a, y0 + d * 0.45, 0.45 + (h - 0.45) * b]), 1, 2, 'piedra', PIEDRA[1], hacia=np.array([0, -1.0, 0]))
        G.rejilla(lambda a, b: np.array([xm + (x1 - xm) * a, y0 + d * b, 0.04]), 3, 4, 'piedra', '#4f4b45', hacia=Z3)   # suelo de losas
    for (px, py) in ((x1 - 0.2, y0 + 0.2), (xm + (x1 - xm) * 0.5, y0 + 0.2), (x1 - 0.2, y0 + d * 0.45 - 0.3)):
        if G.lod < 2 or px == x1 - 0.2: G.caja((px, py, (h + 0.3) / 2), (0.26, 0.26, h - 0.3), 'madera', VIGA, None, 'zZ')
        if G.lod == 0: G.caja((px, py, 0.4), (0.42, 0.42, 0.5), 'piedra', PIEDRA[2], None, 'z')
    if G.lod < 2:
        G.caja(((xm + x1) / 2, y0 + 0.2, h - 0.12), (x1 - xm, 0.24, 0.26), 'madera', VIGA); G.caja((x1 - 0.2, y0 + d * 0.225, h - 0.12), (0.24, d * 0.45, 0.26), 'madera', VIGA)
    if G.lod == 0:
        F = Cara((xm, y0 + 0.08), (1, 0), x1 - xm)
        for (a, b) in ((x1 - xm - 0.2, x1 - xm - 1.0), ((x1 - xm) * 0.5, (x1 - xm) * 0.5 - 0.8), ((x1 - xm) * 0.5, (x1 - xm) * 0.5 + 0.8)): F.barra(G, a, h - 1.05, b, h - 0.25, 0.14, 0.0, 0.14, 'madera', VIGA)
    # La fragua: hogar de piedra con brasas, campana y chimenea ancha; yunque sobre su tocon, pila de temple y carbon.
    fx, fy = x1 - 1.6, y1 - 1.45
    G.caja((fx, fy, 0.5), (1.9, 1.3, 1.0), 'piedra', PIEDRA[0], None, 'z')
    if G.lod < 2: G.caja((fx, fy, 1.04), (2.05, 1.45, 0.14), 'piedra', PIEDRA[2])
    nb = (5, 3, 1)[G.lod]
    G.rejilla(lambda a, b: np.array([fx - 0.7 + 1.4 * a, fy - 0.45 + 0.9 * b, 1.12 + 0.16 * math.sin(a * 3.14) * math.sin(b * 3.14) + 0.05 * math.sin(a * 17 + b * 9)]), nb, max(1, nb - 1), 'emisivo', BRASA, hacia=Z3,
              colfn=lambda a, b: 0.45 + 0.75 * math.sin(a * 3.14) * math.sin(b * 3.14) * (0.75 + 0.25 * math.sin(a * 23 + b * 31)))
    G.fuego.append((np.array([fx, fy, 1.5]), 1.1))
    if G.lod < 2:   # campana de la fragua
        G.pieza([(fx - 1.0, fy - 0.7, 2.25), (fx + 1.0, fy - 0.7, 2.25), (fx + 1.0, fy + 0.65, 2.25), (fx - 1.0, fy + 0.65, 2.25), (fx - 0.45, fy - 0.1, 3.5), (fx + 0.45, fy - 0.1, 3.5), (fx + 0.45, fy + 0.65, 3.5), (fx - 0.45, fy + 0.65, 3.5)],
                [(0, 1, 5, 4), (1, 2, 6, 5), (3, 0, 4, 7), (0, 1, 2, 3)], 'piedra', PIEDRA[3], dentro=(fx, fy, 2.9))
    # Tejado comun: a dos aguas sobre todo el ancho; la chimenea de la fragua lo atraviesa.
    alto = tejado(G, x0, x1, y0, y1, h, 44, 'x', TEJA2, alero=0.5, hastial='piedra', semilla=23, pandeo=0.12, luz_hastial=None)
    chimenea(G, fx, fy + 0.25, 3.3, alto(0, 0) + 0.7, 1.1, 0.95)
    chimenea(G, x0 + 2.2, -1.0, alto(0, -1.0) - 0.8, alto(0, 0) + 0.5, 0.8, 0.8, humo=False)
    # Yunque sobre tocon, pila de agua y saco de carbon.
    ax, ay = xm + 1.9, y0 + 2.0
    if G.lod < 2:
        G.torno([(0.34, HONDO), (0.3, 0.62)], (8, 6)[G.lod], (ax, ay, 0), 'puerta', TABLA)
        G.caja((ax, ay, 0.86), (0.62, 0.2, 0.2), 'liso', '#3a3a40'); G.caja((ax, ay, 0.7), (0.26, 0.16, 0.16), 'liso', '#3a3a40', None, 'zZ')
    if G.lod == 0:
        G.pieza([(ax + 0.31, ay - 0.1, 0.96), (ax + 0.31, ay + 0.1, 0.96), (ax + 0.31, ay + 0.1, 0.8), (ax + 0.31, ay - 0.1, 0.8), (ax + 0.62, ay, 0.93)], [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)], 'liso', '#3a3a40', dentro=(ax + 0.4, ay, 0.88))
        G.caja((ax, ay, 0.64), (0.4, 0.26, 0.06), 'liso', '#3a3a40')
        G.caja((xm + 0.75, y0 + 3.6, 0.38), (0.8, 1.5, 0.76), 'piedra', PIEDRA[2], None, 'zZ'); G.caja((xm + 0.75, y0 + 3.6, 0.68), (0.62, 1.3, 0.02), 'liso', '#1c2a33', None, 'zxXyY')
        G.torno([(0.42, 0.0), (0.5, 0.3), (0.36, 0.72), (0.14, 0.82)], 7, (x1 - 1.2, y0 + 1.5, 0.02), 'liso', '#4a4034')
    lenera(G, xm + 0.5, xm + 2.6, y1 - 1.0, 0.05, 3)
    hiedra(G, B['I'], d * 0.55, 0.2, 2.2, 2.9, 21)


# 3 · Casa del sabio (9 × 10): casa de piedra con pizarra y un torreon ochavado de chapitel en la esquina del frente.
def sabio(G):
    w, d = 9, 10; x0, x1, y0, y1 = -w / 2, w / 2, -d / 2, d / 2; rng = G.rng; h1 = 2.9; h = 5.4
    cimiento(G, x0, x1, y0, y1, 0.6, 0.14, hueco=('F', 3.0 - 0.82, 3.0 + 0.82))
    B = caras(x0, x1, y0, y1)
    for ca in B.values(): muro(G, ca, 0.5, h1, 'piedra', PIEDRA[0])
    esquinales(G, x0, x1, y0, y1, 0.7, h1 - 0.1)
    l = _luces(rng, 8, 0.6, LUZ + [VIOLETA]); c = '#3a3350'
    puerta(G, B['F'], 3.0, 0.3, 1.2, 2.25, arq=True, marco='piedra'); antorcha(G, B['F'], 1.75, 1.8)
    ventana(G, B['F'], 0.95, 1.2, 0.7, 1.1, l[0], c, lados=(0, 1)); ventana(G, B['I'], d * 0.3, 1.2, 0.8, 1.1, l[1], c); ventana(G, B['I'], d * 0.7, 1.2, 0.8, 1.1, l[2], c)
    ventana(G, B['T'], w * 0.3, 1.2, 0.8, 1.1, l[3], c); ventana(G, B['D'], d * 0.68, 1.2, 0.8, 1.1, l[4], c)
    # Planta alta de entramado oscuro.
    A = caras(x0, x1, y0, y1); z1 = h1 + 0.2
    if G.lod < 2:
        for ca in B.values(): viga(G, ca, 0, ca.L, h1, z1, 0.08, clave=True)
    entramado(G, A['F'], z1, h, 6, {1: l[5]}, (1,), 0.0, YESO2, c); entramado(G, A['T'], z1, h, 6, {2: l[6], 4: VIOLETA}, (1, -6), 0.0, YESO2, c)
    entramado(G, A['I'], z1, h, 7, {2: l[7], 5: LUZ[1]}, (1, -7), 0.0, YESO2, c); entramado(G, A['D'], z1, h, 7, {4: LUZ[0]}, (-7,), 0.0, YESO2, c)
    alto = tejado(G, x0, x1, y0, y1, h, 53, 'y', PIZARRA, alero=0.4, hastial='entramado', semilla=31, pandeo=0.08, yeso=YESO2, luz_hastial=VIOLETA)
    chimenea(G, x0 + 1.4, y1 - 3.0, alto(x0 + 1.4, 0) - 0.9, alto(0, 0) + 0.8, 0.9, 0.9)
    # Torreon: prisma de ocho caras que nace del suelo, con imposta, ventanas en pico y chapitel.
    r = 2.05; cx, cy = x1 - 1.8, y0 + 1.8; ht = 10.6; L8 = (8, 8, 6)[G.lod]; a0 = math.pi / L8
    perfil = [(r + 0.16, HONDO), (r + 0.14, 0.7), (r, 0.82)] + [(r - 0.012 * z, z) for z in ((2.4, 4.0, 5.6, 7.2, 8.8, ht) if G.lod == 0 else (ht,))]
    G.torno(perfil, L8, (cx, cy, 0), 'piedra', PIEDRA[2], a0, tapa=False)
    if G.lod < 2:
        G.torno([(r - 0.1, ht - 0.5), (r + 0.26, ht - 0.2), (r + 0.26, ht + 0.02)], L8, (cx, cy, 0), 'piedra', PIEDRA[0], a0, tapa=False)
        G.torno([(r - 0.03, 5.5), (r + 0.1, 5.58), (r + 0.1, 5.72), (r - 0.05, 5.8)], L8, (cx, cy, 0), 'piedra', PIEDRA[0], a0, tapa=False)
    piramide(G, (cx, cy), r + 0.26, ht, 5.2, L8, PIZARRA, a0, alero=0.3, semilla=50)
    # Ventanas del torreon en las caras que miran fuera (frente y derecha): abajo ambar, arriba violeta.
    def cara_torre(k, z):
        a = 2 * math.pi * k / L8; nx, ny = math.cos(a), math.sin(a); rz = r - 0.012 * z
        rc = rz * math.cos(math.pi / L8); lado = 2 * rz * math.sin(math.pi / L8)
        return Cara((cx + nx * rc + ny * lado / 2, cy + ny * rc - nx * lado / 2), (-ny, nx), lado)
    for k in range(L8):
        a = 2 * math.pi * k / L8; nx, ny = math.cos(a), math.sin(a)
        if not (ny < -0.3 or nx > 0.3) or (nx < -0.5) or (ny > 0.5): continue
        ct = cara_torre(k, 8.2); ventana(G, ct, ct.L / 2, 8.2, 0.55, 1.5, VIOLETA, contras=None, punta=0.35)
        if k % 2 == 0: ct = cara_torre(k, 3.4); ventana(G, ct, ct.L / 2, 3.4, 0.5, 1.25, LUZ[k % 3] if k != 0 else None, contras=None, punta=0.3)
        elif G.lod == 0: ct = cara_torre(k, 6.1); ventana(G, ct, ct.L / 2, 6.1, 0.4, 0.9, None, contras=None, punta=0.25)
    if G.lod < 2: ct = cara_torre(L8 - 1, 2.0); hiedra(G, ct, ct.L * 0.5, 0.2, 1.7, 5.8, 6)
    hiedra(G, B['T'], w * 0.7, 0.2, 2.4, 2.6, 12)
    # Veleta: aguja de hierro con una media luna.
    if G.lod < 2:
        zt = ht + 5.2
        G.caja((cx, cy, zt + 0.5), (0.05, 0.05, 1.3), 'liso', HIERRO, None, 'z')
        G.torno([(0.12, 0.0), (0.16, 0.1), (0.1, 0.2)], 5, (cx, cy, zt + 0.25), 'liso', BRONCE)
        pts = [(math.cos(t) * 0.26, math.sin(t) * 0.26) for t in np.linspace(0.6, 5.7, 7)] + [(math.cos(t) * 0.17 + 0.1, math.sin(t) * 0.17) for t in np.linspace(5.3, 1.0, 5)]
        for sg in (1, -1): G.pieza([(cx + 0.02 * sg, cy + u_, zt + 1.3 + v_) for u_, v_ in pts], [tuple(range(len(pts)))], 'liso', BRONCE, hacia=np.array([sg, 0, 0.0]))


# 5 · El horno de la abuela (8 × 8): casita de entramado con tejado de paja y, en su corral, el horno de pan.
def horno(G):
    w, d = 8, 8; x0, x1, y0, y1 = -w / 2, w / 2, -d / 2, d / 2; rng = G.rng; xm = 0.9; h = 2.75
    B = caras(x0, xm, y0, y1)
    cimiento(G, x0, xm, y0, y1, 0.75, 0.13, CIMIENTO, hueco=('F', 2.5 * (xm - x0) / 4 - 0.72, 2.5 * (xm - x0) / 4 + 0.72))
    l = _luces(rng, 5, 0.75); c = '#5a2e2a'
    entramado(G, B['F'], 0.75, h, 4, {0: l[0], 3: l[1]}, (), 0.0, YESO, c, puerta_en=2); puerta(G, B['F'], 2.5 * (xm - x0) / 4, 0.3, (xm - x0) / 4 - 0.2, 2.05)
    antorcha(G, B['F'], 1.5 * (xm - x0) / 4, 1.75)
    entramado(G, B['T'], 0.75, h, 4, {1: l[2]}, (1, -4), 0.0, YESO, c); entramado(G, B['I'], 0.75, h, 6, {1: l[3], 4: l[4]}, (1, -6), 0.0, YESO, c); entramado(G, B['D'], 0.75, h, 6, {2: LUZ[2]}, (1, -6), 0.0, YESO, c)
    alto = tejado(G, x0, xm, y0, y1, h, 54, 'y', PAJA, alero=0.55, vuelo=0.4, hastial='entramado', semilla=71, pandeo=0.16, paso=0.1, grueso=0.24, luz_hastial=LUZ[1])
    chimenea(G, x0 + 1.2, y1 - 2.2, alto(x0 + 1.2, 0) - 0.8, alto((x0 + xm) / 2, 0) + 0.6, 0.85, 0.85, PIEDRA[3])
    # Corral: murete bajo de piedra que cierra la huella, con el horno de boveda, su leñera y la mesa del pan.
    C = caras(xm, x1, y0, y1)
    for k in 'FDT':
        ca = C[k]; n = math.ceil(ca.L / 1.6) if G.lod == 0 else 1
        G.rejilla(lambda a, b: ca.p(ca.L * a, HONDO + (0.95 - HONDO) * b + (0.07 * math.sin(a * ca.L * 2.1) if b > 0.5 else 0), 0), n, 1, 'piedra', PIEDRA[3], hacia=ca.n)
        if G.lod < 2:
            G.rejilla(lambda a, b: ca.p(ca.L * a, HONDO + (0.95 - HONDO) * b + (0.07 * math.sin(a * ca.L * 2.1) if b > 0.5 else 0), -0.4), n, 1, 'piedra', PIEDRA[3], hacia=-ca.n)
            G.rejilla(lambda a, b: ca.p(ca.L * a, 0.95 + 0.07 * math.sin(a * ca.L * 2.1), -0.4 * b), n, 1, 'piedra', PIEDRA[2], hacia=Z3)
    ox, oy = x1 - 1.75, y1 - 1.85; R = 1.25
    G.caja((ox, oy, 0.4), (2.7, 2.7, 0.8 - HONDO * 0), 'piedra', PIEDRA[1], None, 'z')
    if G.lod < 2: G.caja((ox, oy, 0.85), (2.9, 2.9, 0.12), 'piedra', PIEDRA[2])
    L = (10, 7, 5)[G.lod]; an = (5, 3, 2)[G.lod]
    G.torno([(R * math.cos(t), 0.9 + R * 0.92 * math.sin(t)) for t in np.linspace(0, math.pi / 2 * 0.97, an)], L, (ox, oy, 0), 'liso', '#9a8468', math.pi / L)
    if G.lod < 2:
        bo = Cara((ox - 0.5, oy - R - 0.12), (1, 0), 1.0)
        bo.caja(G, 0.0, 1.0, 0.9, 1.75, -0.5, 0.0, 'piedra', PIEDRA[0], 'y')
        if G.lod == 0: arco(G, bo, 0.5, 1.02, 0.34, 5, 0.16, 0.06)
        bo.poli(G, [(0.16, 0.92), (0.84, 0.92)] + [(0.5 + math.cos(t) * 0.34, 1.02 + math.sin(t) * 0.34) for t in np.linspace(0, math.pi, 6)], 0.012, 'emisivo', '#ff7a1e')
        G.torno([(0.2, 0.0), (0.17, 0.75), (0.22, 0.8)], 6, (ox + 0.2, oy + 0.5, 1.9), 'liso', '#9a8468')
        G.humo.append((ox + 0.2, oy + 0.5, 3.0))
    else: G.caja((ox, oy - R - 0.1, 1.2), (0.6, 0.1, 0.5), 'emisivo', '#ff7a1e', None, 'zZY')
    G.fuego.append((np.array([ox, oy - R - 0.25, 1.25]), 0.9))
    lenera(G, xm + 0.25, xm + 2.3, y1 - 0.9, 0.0, 3)
    if G.lod < 2:   # mesa con panes y pala de hornear
        mx, my = xm + 1.3, y0 + 1.6
        G.caja((mx, my, 0.82), (1.5, 0.8, 0.07), 'puerta', TABLA)
        for dx in (-0.62, 0.62):
            for dy in (-0.3, 0.3): G.caja((mx + dx, my + dy, 0.4), (0.09, 0.09, 0.8), 'puerta', VIGA, None, 'zZ')
        if G.lod == 0:
            for (dx, dy, s) in ((-0.4, 0.05, 1.0), (0.05, -0.12, 0.85), (0.42, 0.1, 1.1)):
                G.torno([(0.17 * s, 0.0), (0.2 * s, 0.07), (0.12 * s, 0.15)], 6, (mx + dx, my + dy, 0.86), 'liso', '#b07a3c', ey=0.75)
            G.caja((ox - 1.9, oy - 1.0, 1.0), (0.06, 0.06, 2.0), 'puerta', TABLA, np.array([[1, 0, 0.2], [0, 1, 0], [-0.2, 0, 1.0]])); G.caja((ox - 2.1, oy - 1.0, 0.12), (0.4, 0.5, 0.04), 'puerta', TABLA)
    barril(G, xm + 0.6, y0 + 0.75, r=0.34, alto=0.9)


# El campanario (huella 4,8 × 4,8; el juego choca con un circulo de 3 m): torre de piedra en talud, cuerpo de
# campanas abierto con cuatro arcos, la campana de bronce a la vista y chapitel de teja.
def campanario(G):
    a = 2.3; rng = G.rng; hb = 9.2; hc = 12.4
    def lado_en(z): return a - 0.036 * max(0.0, min(z, hb) - 3.0)
    niv = (0.6, 1.8, 3.0, 4.5, 6.0, 7.6, hb) if G.lod == 0 else ((0.6, 3.0, hb) if G.lod == 1 else (HONDO, 3.0, hb))
    G.torno([(lado_en(z) * 1.4142, z) for z in niv], 4, (0, 0, 0), 'piedra', PIEDRA[0], math.pi / 4, tapa=False)
    if G.lod < 2: cimiento(G, -a, a, -a, a, 0.7, 0.15, hueco=('F', a - 0.85, a + 0.85))
    for (x, sx) in ((-a, -1), (a, 1)):
        for (y, sy) in ((-a, -1), (a, 1)):
            if G.lod == 0:
                for k in range(18):
                    lx, ly = (0.6, 0.34) if k % 2 else (0.34, 0.6); z = 1.2 + k * 0.44; e = lado_en(z)
                    G.caja((sx * (e - lx / 2 + 0.04), sy * (e - ly / 2 + 0.04), z), (lx, ly, 0.39), 'piedra', PIEDRA[2] if k % 2 else PIEDRA[3], None, ('X' if sx < 0 else 'x') + ('Y' if sy < 0 else 'y'))
    e = lado_en(hb); B = caras(-e, e, -e, e)
    Bb = caras(-a, a, -a, a)
    puerta(G, Bb['F'], a, 0.25, 1.25, 2.3, arq=True, marco='piedra'); antorcha(G, Bb['F'], a + 1.3, 1.9)
    for k in 'FDTI':
        e3 = lado_en(3.4); e6 = lado_en(5.9)
        if k != 'F': ca = caras(-e3, e3, -e3, e3)[k]; ventana(G, ca, ca.L / 2, 3.4, 0.4, 1.1, None, contras=None, punta=0.22)
        ca = caras(-e6, e6, -e6, e6)[k]; ventana(G, ca, ca.L / 2, 5.9, 0.45, 1.25, LUZ[0] if k in 'FD' else None, contras=None, punta=0.25)
    hiedra(G, Bb['I'], a * 0.9, 0.3, 2.4, 6.2, 15, 0.06); hiedra(G, Bb['T'], a * 1.3, 0.3, 1.8, 3.4, 16, 0.06)
    # Cornisa y cuerpo de campanas: cuatro machones de esquina y un arco por lado.
    if G.lod < 2: G.torno([((e - 0.02) * 1.4142, hb - 0.3), ((e + 0.22) * 1.4142, hb - 0.05), ((e + 0.22) * 1.4142, hb + 0.14)], 4, (0, 0, 0), 'piedra', PIEDRA[2], math.pi / 4, tapa=True)
    else: G.pieza([(-e, -e, hb), (e, -e, hb), (e, e, hb), (-e, e, hb)], [(0, 1, 2, 3)], 'piedra', PIEDRA[2], hacia=Z3)
    m = 0.62; ec = e - 0.02
    for sx in (-1, 1):
        for sy in (-1, 1): G.caja((sx * (ec - m / 2), sy * (ec - m / 2), (hb + hc) / 2), (m, m, hc - hb), 'piedra', PIEDRA[(sx + sy + 2) % 4], None, 'zZ')
    C = caras(-ec, ec, -ec, ec); vano = ec - m; zar = hc - 0.35 - vano
    for k, ca in C.items():
        if G.lod == 0:
            arco(G, ca, ec, zar, vano, 7, 0.3, 0.05, a0=0.0, a1=math.pi)
        nq = (6, 3, 1)[G.lod]
        pts = [(m, hc)] + [(ec + math.cos(t) * vano, zar + math.sin(t) * vano) for t in np.linspace(math.pi, 0, nq + 1)] + [(2 * ec - m, hc)]
        # Enjutas: de la linea del arco al remate, en abanico.
        for i in range(1, len(pts) - 2):
            p0, p1 = pts[i], pts[i + 1]
            ca.poli(G, [p0, p1, (p1[0], hc), (p0[0], hc)], -0.02, 'piedra', PIEDRA[1])
            if G.lod < 2:   # intrados (el canto del arco, visto desde abajo)
                G.pieza([ca.p(p0[0], p0[1], -0.02), ca.p(p1[0], p1[1], -0.02), ca.p(p1[0], p1[1], -m), ca.p(p0[0], p0[1], -m)], [(0, 1, 2, 3)], 'piedra', PIEDRA[3], hacia=np.array([ca.u[0] * (ec - (p0[0] + p1[0]) / 2), ca.u[1] * (ec - (p0[0] + p1[0]) / 2), -1.0]))
        if G.lod < 2: ca.caja(G, m - 0.02, 2 * ec - m + 0.02, hb + 0.14, hb + 1.0, -0.3, -0.06, 'piedra', PIEDRA[3], '')   # antepecho
    G.pieza([(-ec, -ec, hc), (ec, -ec, hc), (ec, ec, hc), (-ec, ec, hc)], [(0, 1, 2, 3)], 'madera', VIGA, hacia=-Z3)
    if G.lod < 2: G.torno([((ec - 0.02) * 1.4142, hc - 0.02), ((ec + 0.2) * 1.4142, hc + 0.16), ((ec + 0.2) * 1.4142, hc + 0.3)], 4, (0, 0, 0), 'piedra', PIEDRA[2], math.pi / 4, tapa=False)
    # Campana de bronce colgada de su yugo.
    if G.lod < 2:
        G.caja((0, 0, hc - 0.55), (2 * ec - 0.3, 0.24, 0.26), 'madera', VIGA)
        G.torno([(0.74, 0.0), (0.66, 0.1), (0.5, 0.42), (0.42, 0.85), (0.3, 1.1), (0.1, 1.2)] if G.lod == 0 else [(0.74, 0.0), (0.46, 0.6), (0.12, 1.2)], (10, 6)[G.lod], (0, 0, hc - 1.95), 'liso', BRONCE, base=True)
        if G.lod == 0: G.torno([(0.11, 0.0), (0.13, 0.12), (0.03, 0.2)], 5, (0, 0, hc - 2.2), 'liso', HIERRO, base=True)
    else: G.caja((0, 0, hc - 1.4), (0.9, 0.9, 1.1), 'liso', BRONCE, None, '')
    # Chapitel de teja con bola y cruz de hierro.
    piramide(G, (0, 0), (ec + 0.2) * 1.4142, hc + 0.3, 5.0, 4, TEJA, math.pi / 4, alero=0.35, semilla=80)
    if G.lod < 2:
        zt = hc + 5.3
        G.torno([(0.1, -0.1), (0.2, 0.08), (0.2, 0.2), (0.06, 0.34)], 6, (0, 0, zt), 'liso', BRONCE)
        G.caja((0, 0, zt + 0.85), (0.07, 0.07, 1.1), 'liso', HIERRO, None, 'z'); G.caja((0, 0, zt + 1.0), (0.6, 0.07, 0.07), 'liso', HIERRO)


CASAS_SUS = [dict(casa=i) for i in range(7)]
T_CASA = (4000, 1300, 260)
definir('casa_entramado', CASAS_SUS[0], T_CASA, casa0, 10)
definir('casa_mercader', CASAS_SUS[1], T_CASA, casa1, 11)
definir('herreria', CASAS_SUS[2], T_CASA, herreria, 12)
definir('casa_sabio', CASAS_SUS[3], (4000, 1400, 300), sabio, 13)
definir('taberna', CASAS_SUS[4], (4200, 1400, 280), taberna, 14)
definir('horno_abuela', CASAS_SUS[5], T_CASA, horno, 15)
definir('casa_piedra', CASAS_SUS[6], T_CASA, casa_piedra, 16)
definir('campanario', dict(torre=1), (3600, 1200, 260), campanario, 17, musgo=0.3)
