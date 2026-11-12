# ═══════════════════════════════════════════════════════
# DUENDE QUEST — biblioteca de modelado para Blender 5.3 (sin ventana)
#
# La usan los guiones de tools/blender/modelos/<familia>.py. Lee GUIA.md.
# Convenciones: metros, Z arriba, origen en el suelo (z = 0), frente hacia -Y.
# Cada modelo es UN objeto con:
#   · ranuras de material = MARCA de cada cara (marcar(obj, 'hoja'))
#   · atributo de punto 'col'    = color lineal (pintar*)
#   · atributo de punto 'viento' = cuanto lo mece el viento, 0..1
#   · atributo de punto 'nesf'   = normal "inflada" para follaje (xyz · peso)
# Al terminar, la biblioteca triangula, suaviza por angulo, hornea la oclusion
# ambiental en el color, comprueba el limite de triangulos y exporta.
# ═══════════════════════════════════════════════════════
import bpy, bmesh, math, json, os, struct
import numpy as np
from mathutils import Vector, noise
from mathutils.bvhtree import BVHTree

# Marcas que entiende el juego (atributo `tinte` del material del kit y del organico).
MARCAS = {'liso': 0, 'hoja': 1, 'teja': 2, 'piedra': 3, 'madera': 4, 'vidrio': 5, 'puerta': 6, 'emisivo': 7, 'monolito': 8}
# Verde de referencia de las hojas: el juego divide por el y multiplica por el color de la zona.
VERDE_REF = np.array([0.12, 0.36, 0.08])
PRESUPUESTO = (1500, 500, 150)

MODELOS = []          # lo llena @modelo
ESTRICTO = [True]     # foto.py lo apaga: una foto no falla por pasarse de triangulos
_FAMILIA = {'nombre': '?'}


# ── utilidades ──
def hexlin(c):
    """'#rrggbb' (sRGB) o (r,g,b) lineal → np.array lineal."""
    if isinstance(c, str):
        c = c.lstrip('#'); v = np.array([int(c[i:i + 2], 16) / 255 for i in (0, 2, 4)])
        return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)
    return np.array(c, dtype=float)[:3]


def azar(semilla):
    return np.random.default_rng(int(semilla) & 0x7fffffff)


def ruido(P, escala=1.0, semilla=0):
    """Ruido suave -1..1 por punto (P: n×3)."""
    o = Vector((semilla * 17.13, semilla * 7.31, semilla * 3.77))
    return np.array([noise.noise(Vector(p) * escala + o) for p in np.asarray(P, dtype=float)])


def ruido_fbm(P, escala=1.0, semilla=0, octavas=3):
    r = np.zeros(len(P)); a = 1.0; f = escala; t = 0.0
    for k in range(octavas):
        r += a * ruido(P, f, semilla + k * 31); t += a; a *= 0.5; f *= 2.0
    return r / t


def limpiar():
    """Escena vacia."""
    bpy.ops.wm.read_factory_settings(use_empty=True)


def _mat(marca):
    if marca not in MARCAS: raise ValueError('marca desconocida: %s (usa %s)' % (marca, ', '.join(MARCAS)))
    n = 'dq_' + marca
    return bpy.data.materials.get(n) or bpy.data.materials.new(n)


def _attr(me, nombre, tipo, valor=None):
    a = me.attributes.get(nombre)
    if a is None:
        a = me.attributes.new(nombre, tipo, 'POINT')
        if valor is not None:
            n = len(me.vertices)
            if tipo == 'FLOAT_COLOR': a.data.foreach_set('color', np.tile(np.array(valor, dtype=np.float32), n))
            elif tipo == 'FLOAT': a.data.foreach_set('value', np.full(n, valor, dtype=np.float32))
    return me.attributes[nombre]


def pos(obj):
    """Posiciones de los vertices (n×3)."""
    me = obj.data; a = np.zeros(len(me.vertices) * 3); me.vertices.foreach_get('co', a); return a.reshape(-1, 3)


def poner_pos(obj, P):
    obj.data.vertices.foreach_set('co', np.asarray(P, dtype=np.float32).ravel()); obj.data.update()


def normales(obj):
    """Normales por vertice (n×3)."""
    me = obj.data; a = np.zeros(len(me.vertices) * 3); me.vertex_normals.foreach_get('vector', a); return a.reshape(-1, 3)


def malla(nombre, verts, caras, marca='liso', color='#888888'):
    """Objeto nuevo a partir de vertices y caras (listas de indices)."""
    me = bpy.data.meshes.new(nombre)
    me.from_pydata([tuple(map(float, v)) for v in verts], [], [tuple(map(int, c)) for c in caras])
    me.update()
    obj = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(obj)
    me.materials.append(_mat(marca))
    pintar(obj, color)
    _attr(me, 'viento', 'FLOAT', 0.0)
    me.shade_smooth()
    return obj


def primitiva(tipo, nombre='prim', marca='liso', color='#888888', **k):
    """tipo: 'cubo' (lado), 'esfera' (radio, subdiv), 'cilindro' (radio, alto, lados), 'cono' (r1, r2, alto, lados).
    El cilindro y el cono nacen apoyados en el suelo."""
    bm = bmesh.new()
    if tipo == 'cubo': bmesh.ops.create_cube(bm, size=k.get('lado', 1.0))
    elif tipo == 'esfera': bmesh.ops.create_icosphere(bm, subdivisions=k.get('subdiv', 2), radius=k.get('radio', 1.0))
    elif tipo in ('cilindro', 'cono'):
        r1 = k.get('r1', k.get('radio', 1.0)); r2 = k.get('r2', r1 if tipo == 'cilindro' else 0.0); h = k.get('alto', 1.0)
        bmesh.ops.create_cone(bm, cap_ends=True, segments=k.get('lados', 12), radius1=r1, radius2=r2, depth=h)
        bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, h / 2))
    else: raise ValueError(tipo)
    me = bpy.data.meshes.new(nombre); bm.to_mesh(me); bm.free()
    obj = bpy.data.objects.new(nombre, me); bpy.context.scene.collection.objects.link(obj)
    me.materials.append(_mat(marca)); pintar(obj, color); _attr(me, 'viento', 'FLOAT', 0.0); me.shade_smooth()
    return obj


# ── transformar ──
def mover(obj, loc=(0, 0, 0), rot=(0, 0, 0), esc=1.0):
    """Mueve, gira (radianes XYZ) y escala LOS DATOS de la malla (el objeto sigue en el origen)."""
    from mathutils import Matrix, Euler
    s = esc if hasattr(esc, '__len__') else (esc, esc, esc)
    m = Matrix.Translation(loc) @ Euler(rot).to_matrix().to_4x4() @ Matrix.Diagonal((s[0], s[1], s[2], 1))
    obj.data.transform(m)
    if s[0] * s[1] * s[2] < 0: obj.data.flip_normals()
    obj.data.update()
    return obj


def aplicar(obj):
    """Aplica todos los modificadores del objeto."""
    if not obj.modifiers: return obj
    dg = bpy.context.evaluated_depsgraph_get()
    nueva = bpy.data.meshes.new_from_object(obj.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    vieja = obj.data; obj.modifiers.clear(); obj.data = nueva
    bpy.data.meshes.remove(vieja)
    return obj


def unir(objs, nombre=None):
    """Junta varios objetos en uno (conserva marcas, color, viento y nesf)."""
    objs = [o for o in objs if o is not None]
    if not objs: return None
    for o in objs:
        aplicar(o); _attr(o.data, 'viento', 'FLOAT', 0.0); _attr(o.data, 'col', 'FLOAT_COLOR', (1, 1, 1, 1)); _attr(o.data, 'nesf', 'FLOAT_VECTOR')
        _afilar(o)
    if len(objs) > 1:
        with bpy.context.temp_override(active_object=objs[0], selected_editable_objects=objs, selected_objects=objs):
            bpy.ops.object.join()
    if nombre: objs[0].name = nombre
    return objs[0]


def copiar(obj):
    o = obj.copy(); o.data = obj.data.copy(); bpy.context.scene.collection.objects.link(o); return o


def borrar(obj):
    me = obj.data; bpy.data.objects.remove(obj); bpy.data.meshes.remove(me)


# ── forma ──
def subdividir(obj, niveles=1, simple=False):
    m = obj.modifiers.new('sub', 'SUBSURF'); m.levels = niveles; m.render_levels = niveles
    if simple: m.subdivision_type = 'SIMPLE'
    return aplicar(obj)


def biselar(obj, ancho=0.03, segmentos=1, angulo=35):
    """Mata los cantos vivos (los cantos biselados atrapan la luz: es lo que mas «sube» un modelo)."""
    m = obj.modifiers.new('bis', 'BEVEL'); m.width = ancho; m.segments = segmentos; m.limit_method = 'ANGLE'; m.angle_limit = math.radians(angulo)
    return aplicar(obj)


def desplazar(obj, fuerza=0.1, escala=1.0, semilla=0, octavas=2, eje=None):
    """Empuja cada vertice por su normal (o por `eje`) segun un ruido: quita lo «perfecto»."""
    P = pos(obj); r = ruido_fbm(P, escala, semilla, octavas)
    D = normales(obj) if eje is None else np.tile(np.array(eje, dtype=float), (len(P), 1))
    poner_pos(obj, P + D * (r * fuerza)[:, None])
    return obj


def deformar(obj, fn):
    """fn(P) → P nuevo (arrays n×3): para doblar, afinar, retorcer."""
    poner_pos(obj, fn(pos(obj))); return obj


def remallar(obj, voxel=0.2):
    """Funde volumenes que se cruzan en una sola piel (pierde color y marcas: pinta despues)."""
    marca = obj.data.materials[0] if obj.data.materials else _mat('liso')
    m = obj.modifiers.new('rem', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = voxel
    aplicar(obj)
    obj.data.materials.clear(); obj.data.materials.append(marca)
    _attr(obj.data, 'col', 'FLOAT_COLOR', (1, 1, 1, 1)); _attr(obj.data, 'viento', 'FLOAT', 0.0)
    obj.data.shade_smooth()
    return obj


def decimar(obj, tris):
    """Reduce a ~`tris` triangulos (conserva color, viento y marcas)."""
    n = contar_tris(obj)
    if n <= tris: return obj
    m = obj.modifiers.new('dec', 'DECIMATE'); m.ratio = max(0.01, tris / n)
    aplicar(obj)
    obj.data.shade_smooth()
    return obj


def contar_tris(obj):
    aplicar(obj)
    return int(sum(len(p.vertices) - 2 for p in obj.data.polygons))


def suavizar(obj, angulo=50):
    """Sombreado suave salvo en los cantos de mas de `angulo` grados."""
    obj.data.shade_smooth()
    obj.data.set_sharp_from_angle(angle=math.radians(angulo))
    obj['dq_afilado'] = 1
    return obj


def _afilar(obj):
    if not obj.get('dq_afilado'): suavizar(obj, 50)


def curva(puntos, n):
    """Pasa una curva suave (Catmull-Rom) por los puntos y devuelve n puntos."""
    P = np.asarray(puntos, dtype=float)
    if len(P) < 3: return np.linspace(P[0], P[-1], n)
    Q = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
    out = []
    for t in np.linspace(0, len(P) - 1, n):
        i = min(int(t), len(P) - 2); u = t - i
        p0, p1, p2, p3 = Q[i], Q[i + 1], Q[i + 2], Q[i + 3]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3))
    return np.array(out)


def tubo(puntos, radios, lados=8, nombre='tubo', marca='madera', color='#5a4634', punta=True, tapa_base=False, perfil=None, giro=0.0):
    """Tubo que sigue una linea de puntos (troncos, ramas, raices, lianas, vigas curvas).
    radios: uno o uno por punto. perfil(t, ang) → factor del radio (t = 0..1 a lo largo, ang en radianes):
    sirve para contrafuertes y nervios. punta: cierra el final en un vertice."""
    P = np.asarray(puntos, dtype=float); n = len(P)
    R = np.full(n, radios, dtype=float) if np.isscalar(radios) else np.asarray(radios, dtype=float)
    T = np.gradient(P, axis=0); T /= np.linalg.norm(T, axis=1)[:, None] + 1e-9
    ref = np.array([1.0, 0, 0]) if abs(T[0][0]) < 0.9 else np.array([0, 1.0, 0])
    N = np.cross(T[0], ref); N /= np.linalg.norm(N)
    verts = []; caras = []
    for i in range(n):
        if i:   # transporte paralelo: el anillo no se retuerce
            N = N - T[i] * np.dot(N, T[i]); N /= np.linalg.norm(N) + 1e-9
        B = np.cross(T[i], N); t = i / max(1, n - 1)
        for k in range(lados):
            a = 2 * math.pi * k / lados + giro * t
            r = R[i] * (perfil(t, a) if perfil else 1.0)
            verts.append(P[i] + (math.cos(a) * N + math.sin(a) * B) * r)
    for i in range(n - 1):
        for k in range(lados):
            a = i * lados + k; b = i * lados + (k + 1) % lados
            caras.append((a, b, b + lados, a + lados))
    if punta:
        verts.append(P[-1] + T[-1] * R[-1] * 0.6); c = len(verts) - 1; o = (n - 1) * lados
        for k in range(lados): caras.append((o + k, o + (k + 1) % lados, c))
    if tapa_base: caras.append(tuple(range(lados - 1, -1, -1)))
    o = malla(nombre, verts, caras, marca, color)
    if not tapa_base: o['dq_afilado'] = 1   # suave del todo (con tapa, que decida suavizar())
    return o


def esfera(centro=(0, 0, 0), radio=1.0, subdiv=2, esc=(1, 1, 1), nombre='esf', marca='hoja', color=(1, 1, 1)):
    o = primitiva('esfera', nombre, marca, color, radio=radio, subdiv=subdiv)
    return mover(o, centro, (0, 0, 0), esc)


def masa(bolas, voxel=0.28, tris=700, ruido_f=0.12, ruido_e=1.3, semilla=0, marca='hoja', inflado=0.65, nombre='masa'):
    """Masa organica (copa, mata, nube de follaje, monticulo): funde las bolas
    [(x, y, z, radio) o (x, y, z, rx, ry, rz)] en una sola piel, la arruga con ruido y la reduce a `tris`.
    inflado: cuanto se redondea el sombreado hacia fuera de cada bola (0 = normales de la malla)."""
    B = [tuple(b) if len(b) == 6 else (b[0], b[1], b[2], b[3], b[3], b[3]) for b in bolas]
    objs = [esfera((b[0], b[1], b[2]), 1.0, 2, (b[3], b[4], b[5]), marca=marca) for b in B]
    o = unir(objs, nombre)
    remallar(o, voxel)
    if ruido_f: desplazar(o, ruido_f, ruido_e, semilla, 2)
    decimar(o, tris)
    inflar(o, [(b[0], b[1], b[2]) for b in B], inflado)
    if marca == 'hoja': poner_viento(o, 1.0)
    o['dq_afilado'] = 1; o.data.shade_smooth()
    return o


def inflar(obj, centros, peso=0.65):
    """Normales «infladas»: cada vertice mira hacia fuera del centro mas cercano. El follaje se sombrea
    como un volumen blando en vez de cara a cara."""
    P = pos(obj); C = np.asarray(centros, dtype=float)
    d = P[:, None, :] - C[None, :, :]; k = np.argmin((d ** 2).sum(2), axis=1)
    v = d[np.arange(len(P)), k]; v /= np.linalg.norm(v, axis=1)[:, None] + 1e-9
    a = _attr(obj.data, 'nesf', 'FLOAT_VECTOR'); a.data.foreach_set('vector', (v * peso).astype(np.float32).ravel())
    return obj


def hojas_sueltas(base, n=120, tam=0.35, semilla=0, fuera=0.08, color=(1, 1, 1), marca='hoja', centros=None, inflado=0.75):
    """Hojas (triangulos sueltos de dos caras) repartidas sobre la piel de `base`: rompen la silueta lisa de una masa."""
    rng = azar(semilla); me = base.data; me.calc_loop_triangles()
    P = pos(base); T = np.array([t.vertices[:] for t in me.loop_triangles])
    A = np.array([t.area for t in me.loop_triangles]); A = A / A.sum()
    NT = np.array([t.normal[:] for t in me.loop_triangles])
    ks = rng.choice(len(T), n, p=A); verts = []; caras = []
    for k in ks:
        u, v = rng.random(2)
        if u + v > 1: u, v = 1 - u, 1 - v
        p = P[T[k][0]] * (1 - u - v) + P[T[k][1]] * u + P[T[k][2]] * v
        nn = NT[k] + rng.normal(0, 0.45, 3); nn /= np.linalg.norm(nn)
        t1 = np.cross(nn, [0, 0, 1.0]); t1 /= np.linalg.norm(t1) + 1e-9
        ang = rng.uniform(0, 6.283); lado = math.cos(ang) * t1 + math.sin(ang) * np.cross(nn, t1)
        fr = np.cross(lado, nn) * 0.55 + nn * 0.75; fr /= np.linalg.norm(fr)   # la hoja sale hacia fuera, algo tumbada
        s = tam * rng.uniform(0.7, 1.3); o = p + nn * fuera * rng.uniform(-0.5, 1.0); i = len(verts)
        verts += [o - lado * s * 0.5, o + lado * s * 0.5, o + fr * s * 1.25 + np.array([0, 0, -0.18 * s])]
        caras.append((i, i + 1, i + 2))
    o = malla('hojas', verts, caras, marca, color)
    if centros is None:
        c = P.mean(0); centros = [c]
    inflar(o, centros, inflado); poner_viento(o, 1.0); dos_caras(o); o['dq_afilado'] = 1
    return o


def dos_caras(obj):
    """Laminas sueltas (hojas, cintas, telas): el juego dibuja una sola cara, asi que se duplican dadas la vuelta.
    Llamalo DESPUES de pintar e inflar (la copia hereda color, viento y normales infladas)."""
    aplicar(obj); me = obj.data
    bm = bmesh.new(); bm.from_mesh(me)
    r = bmesh.ops.duplicate(bm, geom=bm.faces[:] + bm.edges[:] + bm.verts[:])
    bmesh.ops.reverse_faces(bm, faces=[g for g in r['geom'] if isinstance(g, bmesh.types.BMFace)])
    bm.to_mesh(me); bm.free(); me.update()
    return obj


# ── marcas, color y viento ──
def marcar(obj, marca, donde=None):
    """Marca de material de las caras. donde(centros n×3, normales n×3) → mascara; sin `donde`, todas."""
    me = obj.data; m = _mat(marca)
    if m.name not in [x.name for x in me.materials if x]: me.materials.append(m)
    idx = [x.name for x in me.materials].index(m.name); n = len(me.polygons)
    cur = np.zeros(n, dtype=np.int32); me.polygons.foreach_get('material_index', cur)
    if donde is None: cur[:] = idx
    else:
        C = np.zeros(n * 3); me.polygons.foreach_get('center', C); N = np.zeros(n * 3); me.polygons.foreach_get('normal', N)
        cur[np.asarray(donde(C.reshape(-1, 3), N.reshape(-1, 3)), dtype=bool)] = idx
    me.polygons.foreach_set('material_index', cur); me.update()
    return obj


def color_de(obj):
    a = _attr(obj.data, 'col', 'FLOAT_COLOR', (1, 1, 1, 1)); c = np.zeros(len(obj.data.vertices) * 4); a.data.foreach_get('color', c); return c.reshape(-1, 4)[:, :3].copy()


def poner_color(obj, C):
    a = _attr(obj.data, 'col', 'FLOAT_COLOR', (1, 1, 1, 1)); n = len(obj.data.vertices)
    c = np.ones((n, 4), dtype=np.float32); c[:, :3] = np.clip(C, 0, 8); a.data.foreach_set('color', c.ravel())
    return obj


def pintar(obj, color):
    """Un color para todo el objeto ('#rrggbb'). En caras 'hoja' el color es un MULTIPLICADOR del verde de la
    zona: (1,1,1) = el color de la zona tal cual; (1.2,1.1,0.8) = mas claro y calido."""
    return poner_color(obj, np.tile(hexlin(color), (len(obj.data.vertices), 1)))


def pintar_fn(obj, fn):
    """fn(P, N, C) → colores lineales n×3 (P posiciones, N normales, C color actual)."""
    return poner_color(obj, fn(pos(obj), normales(obj), color_de(obj)))


def degradar(obj, abajo, arriba, z0=None, z1=None, eje=2):
    """Degradado entre dos colores a lo largo de un eje (por defecto, de abajo a arriba)."""
    P = pos(obj)[:, eje]; z0 = P.min() if z0 is None else z0; z1 = P.max() if z1 is None else z1
    t = np.clip((P - z0) / max(1e-6, z1 - z0), 0, 1)[:, None]
    return poner_color(obj, hexlin(abajo) * (1 - t) + hexlin(arriba) * t)


def variar(obj, fuerza=0.15, escala=1.5, semilla=0, tono=None, estirar=(1, 1, 1)):
    """Variacion de color horneada: manchas de luz y sombra (y, con `tono`, vira hacia ese color)."""
    P = pos(obj) * np.array(estirar); r = ruido_fbm(P, escala, semilla, 3); C = color_de(obj)
    C *= (1 + r * fuerza)[:, None]
    if tono is not None:
        k = np.clip(r * 1.6, 0, 1)[:, None] * 0.6; C = C * (1 - k) + hexlin(tono) * k
    return poner_color(obj, C)


def manchar(obj, color, donde, fuerza=1.0, escala=2.0, semilla=5, borde=0.25):
    """Mancha (musgo, nieve, hollin, oxido): donde(P, N) → 0..1 dice cuanto; un ruido rompe el borde."""
    P = pos(obj); N = normales(obj); k = np.clip(np.asarray(donde(P, N), dtype=float), 0, 1)
    k = np.clip((k + ruido_fbm(P, escala, semilla, 2) * borde - 0.5) / 0.25 + 0.5, 0, 1) * fuerza
    C = color_de(obj); return poner_color(obj, C * (1 - k[:, None]) + hexlin(color) * k[:, None])


def desgastar(obj, luz=0.25, sombra=0.25):
    """Aclara los cantos salientes y oscurece las hendiduras (curvatura horneada en el color)."""
    me = obj.data; P = pos(obj); N = normales(obj); n = len(P)
    E = np.zeros(len(me.edges) * 2, dtype=np.int32); me.edges.foreach_get('vertices', E); E = E.reshape(-1, 2)
    S = np.zeros((n, 3)); K = np.zeros(n)
    np.add.at(S, E[:, 0], P[E[:, 1]]); np.add.at(S, E[:, 1], P[E[:, 0]]); np.add.at(K, E[:, 0], 1); np.add.at(K, E[:, 1], 1)
    lap = P - S / np.maximum(K, 1)[:, None]; L = np.sqrt(np.maximum(1e-12, ((S / np.maximum(K, 1)[:, None] - P) ** 2).sum(1)))
    cur = (lap * N).sum(1) / (np.median(L) + 1e-6)   # > 0 saliente, < 0 hendido
    f = 1 + np.clip(cur, 0, 1) * luz - np.clip(-cur, 0, 1) * sombra
    return poner_color(obj, color_de(obj) * f[:, None])


def poner_viento(obj, v):
    """Cuanto mece el viento cada vertice: numero, array o fn(P) → 0..1."""
    n = len(obj.data.vertices); a = _attr(obj.data, 'viento', 'FLOAT', 0.0)
    w = v(pos(obj)) if callable(v) else (np.full(n, v) if np.isscalar(v) else np.asarray(v))
    a.data.foreach_set('value', np.clip(w, 0, 1).astype(np.float32)); return obj


# ── registro ──
def modelo(nombre, sustituye=None, tris=PRESUPUESTO, ao=0.75, ao_dist=1.6, lods='propio', suelo=True):
    """Decorador. La funcion recibe el nivel de detalle (0 alto, 1 medio, 2 bajo) y devuelve UN objeto.
    lods='decimar': solo se llama con 0 y los otros dos niveles se sacan reduciendo hasta el presupuesto.
    sustituye: que pieza del mundo reemplaza (ver GUIA.md), p. ej. {'flora': 'pino', 'zonas': ['noche'], 'alto': 9}.
    ao: fuerza de la oclusion horneada (0 = sin ella); suelo: el suelo tambien da sombra."""
    def deco(fn):
        MODELOS.append(dict(nombre=nombre, fn=fn, sus=sustituye or {}, tris=tuple(tris), ao=ao, ao_dist=ao_dist, lods=lods, suelo=suelo))
        return fn
    return deco


# ── acabado y exportacion ──
def _triangular(obj):
    aplicar(obj); me = obj.data
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.triangulate(bm, faces=bm.faces); bm.to_mesh(me); bm.free(); me.update()


def hornear_ao(obj, fuerza=0.75, dist=1.6, rayos=40, suelo=True, semilla=1):
    """Oclusion ambiental por vertice (rayos contra el propio modelo y el suelo). Devuelve 0..1 (1 = despejado)."""
    me = obj.data; P = pos(obj); N = _normal_vertice(obj)
    polys = [tuple(p.vertices) for p in me.polygons]
    bvh = BVHTree.FromPolygons([tuple(p) for p in P], polys)
    rng = azar(semilla); D = rng.normal(0, 1, (rayos, 3)); D /= np.linalg.norm(D, axis=1)[:, None]
    ao = np.ones(len(P))
    for i in range(len(P)):
        n = N[i]; o = P[i] + n * 0.03; tot = 0.0; occ = 0.0
        for d in D:
            c = float(d @ n)
            if c < 0: d = -d; c = -c
            if c < 0.08: continue
            tot += c
            h = bvh.ray_cast(o, d, dist)
            if h[0] is not None: occ += c * (1 - h[3] / dist) ** 0.5
            elif suelo and d[2] < -1e-3 and o[2] >= 0:
                t = -o[2] / d[2]
                if t < dist: occ += c * (1 - t / dist) ** 0.5
        ao[i] = 1 - occ / max(tot, 1e-6)
    return 1 - fuerza * (1 - ao)


def _normal_vertice(obj):
    N = normales(obj); me = obj.data
    if 'nesf' in me.attributes:
        S = np.zeros(len(me.vertices) * 3); me.attributes['nesf'].data.foreach_get('vector', S); S = S.reshape(-1, 3)
        w = np.linalg.norm(S, axis=1)[:, None]; N = N * (1 - np.clip(w, 0, 1)) + S
        N /= np.linalg.norm(N, axis=1)[:, None] + 1e-9
    return N


def terminar(obj, m):
    """Deja un nivel listo: devuelve los arrays que se exportan (y deja en la malla el color 'foto' y las normales)."""
    _triangular(obj)
    obj.data.transform(obj.matrix_world); obj.matrix_world.identity()
    _afilar(obj)
    me = obj.data; me.calc_loop_triangles(); nt = len(me.loop_triangles)
    if nt == 0: raise RuntimeError('modelo vacio')
    P = pos(obj); C = color_de(obj)
    W = np.zeros(len(P)); _attr(me, 'viento', 'FLOAT', 0.0).data.foreach_get('value', W)
    AO = hornear_ao(obj, m['ao'], m['ao_dist'], suelo=m['suelo']) if m['ao'] > 0 else np.ones(len(P))
    L = np.zeros(nt * 3, dtype=np.int32); me.loop_triangles.foreach_get('loops', L)
    V = np.zeros(nt * 3, dtype=np.int32); me.loop_triangles.foreach_get('vertices', V)
    MI = np.zeros(nt, dtype=np.int32); me.loop_triangles.foreach_get('material_index', MI)
    cod = np.array([MARCAS.get((x.name if x else 'dq_liso')[3:], 0) for x in me.materials] or [0])
    marca = np.repeat(cod[MI], 3)
    CN = np.zeros(len(me.loops) * 3); me.corner_normals.foreach_get('vector', CN); CN = CN.reshape(-1, 3)[L]
    if 'nesf' in me.attributes:
        S = np.zeros(len(P) * 3); me.attributes['nesf'].data.foreach_get('vector', S); S = S.reshape(-1, 3)[V]
        w = np.clip(np.linalg.norm(S, axis=1), 0, 1)[:, None]; CN = CN * (1 - w) + S
    CN /= np.linalg.norm(CN, axis=1)[:, None] + 1e-9
    col = C[V] * AO[V][:, None]
    hoja = marca == MARCAS['hoja']
    col[hoja] *= VERDE_REF   # en hojas el color pintado es un multiplicador del verde de la zona
    # Para la foto: color final por vertice y normales finales en la malla.
    fa = me.attributes.get('foto') or me.attributes.new('foto', 'FLOAT_COLOR', 'POINT')
    F = np.ones((len(P), 4), dtype=np.float32); F[V, :3] = np.clip(col, 0, 1); fa.data.foreach_set('color', F.ravel())
    try:
        NL = np.zeros((len(me.loops), 3), dtype=np.float32); NL[L] = CN; me.normals_split_custom_set([tuple(x) for x in NL])
    except Exception as e: print('[dq] normales de foto:', e)
    # Juego: X = X, Y = Z de Blender, Z = -Y de Blender.
    conv = lambda A: np.stack([A[:, 0], A[:, 2], -A[:, 1]], axis=1)
    Pg = conv(P[V]); Ng = conv(CN)
    n8 = (np.clip(np.round(Ng * 31), -31, 31) * 4).astype(np.int8)   # 6 bits por eje: sobra para Lambert y comprime mejor
    s = np.clip(col, 0, 1); c8 = np.round(np.where(s <= 0.0031308, s * 12.92, 1.055 * s ** (1 / 2.4) - 0.055) * 63).astype(np.uint8) * 4 + 2   # 6 bits por canal
    w8 = np.round(np.clip(W[V], 0, 1) * 15).astype(np.uint8) * 17
    clave = np.concatenate([V[:, None].astype(np.int64), n8.astype(np.int64) // 8, marca[:, None].astype(np.int64)], axis=1)
    _, prim, inv = np.unique(clave, axis=0, return_index=True, return_inverse=True)
    inv = np.asarray(inv).ravel()
    if len(prim) > 65535: raise RuntimeError('mas de 65535 vertices')
    # Vertices numerados por orden de primer uso: vecinos en la malla quedan vecinos en el archivo (comprime mucho mejor).
    _, primero = np.unique(inv, return_index=True); orden = np.argsort(primero, kind='stable')
    nuevo = np.empty(len(orden), dtype=np.int64); nuevo[orden] = np.arange(len(orden)); prim = prim[orden]; inv = nuevo[inv]
    return dict(pos=Pg[prim].astype(np.float32), nor=n8[prim], col=c8[prim], marca=marca[prim].astype(np.uint8), viento=w8[prim], idx=inv.astype(np.uint16), tris=nt)


def construir(m, solo_lod=None):
    """Construye los 3 niveles de un modelo registrado. Devuelve [(objeto, datos)]."""
    niveles = []
    for lod in range(3):
        if solo_lod is not None and lod != solo_lod: niveles.append(None); continue
        if m['lods'] == 'decimar' and lod > 0:
            obj = copiar(niveles[0][0]); obj['dq_afilado'] = 0
            if 'foto' in obj.data.attributes: obj.data.attributes.remove(obj.data.attributes['foto'])
            decimar(obj, m['tris'][lod])
        else:
            obj = m['fn'](lod)
            if isinstance(obj, (list, tuple)): obj = unir(list(obj))
            if m['lods'] == 'decimar': decimar(obj, m['tris'][0])   # el nivel alto tambien se ajusta a su limite
        obj.name = '%s_L%d' % (m['nombre'], lod)
        d = terminar(obj, m)
        lim = m['tris'][lod]
        estado = 'bien' if d['tris'] <= lim else ('JUSTO' if d['tris'] <= lim * 1.1 else 'PASADO')
        print('[dq] %-22s L%d %5d tris (limite %d) %5d vertices  %s' % (m['nombre'], lod, d['tris'], lim, len(d['pos']), estado))
        if estado == 'PASADO' and ESTRICTO[0]: raise RuntimeError('%s L%d: %d triangulos, el limite es %d' % (m['nombre'], lod, d['tris'], lim))
        niveles.append((obj, d))
    return niveles


def _zz(d):
    """Enteros con signo → sin signo (zigzag) en dos planos de bytes: primero los bajos y luego los altos."""
    d = np.asarray(d, dtype=np.int64); u = ((d << 1) ^ (d >> 63)).astype(np.uint16)
    return (u & 255).astype(np.uint8).tobytes() + (u >> 8).astype(np.uint8).tobytes()


def _bloque(d, mn, rango):
    """Un nivel en el formato del paquete (lo lee mundo/js/modelado.js):
    posiciones a 12 bits como diferencias con el vertice anterior, normales y color por planos, marca, viento
    e indices como «distancia al ultimo vertice estrenado»."""
    q = np.round((d['pos'] - mn) / rango * 4095).astype(np.int64)
    dq = np.diff(q, axis=0, prepend=np.zeros((1, 3), dtype=np.int64))
    idx = d['idx'].astype(np.int64); tope = np.maximum.accumulate(idx); ant = np.concatenate([[-1], tope[:-1]])
    b = b''.join(_zz(dq[:, e]) for e in range(3))
    b += b''.join(d['nor'][:, e].tobytes() for e in range(3)) + b''.join(d['col'][:, e].tobytes() for e in range(3))
    b += d['marca'].tobytes() + d['viento'].tobytes() + _zz(ant + 1 - idx)
    return b + b'\0' * ((4 - len(b) % 4) % 4)


def exportar(familia, salida):
    """Construye todos los modelos registrados y escribe <salida>/dq_<familia>.bin y .json."""
    binario = bytearray(); indice = {}
    for m in MODELOS:
        limpiar_objetos()
        niveles = construir(m)
        todo = np.concatenate([d['pos'] for _, d in niveles])
        mn = todo.min(0); mx = todo.max(0); rango = np.maximum(mx - mn, 1e-6)
        lods = []
        for _, d in niveles:
            o = len(binario); v = len(d['pos'])
            binario += _bloque(d, mn, rango)
            lods.append(dict(o=o, v=v, i=len(d['idx'])))
        indice[m['nombre']] = dict(min=[round(float(x), 4) for x in mn], max=[round(float(x), 4) for x in mx], lods=lods, sus=m['sus'])
    os.makedirs(salida, exist_ok=True)
    with open(os.path.join(salida, 'dq_%s.bin' % familia), 'wb') as f: f.write(binario)
    with open(os.path.join(salida, 'dq_%s.json' % familia), 'w', encoding='utf-8') as f:
        json.dump(dict(v=2, familia=familia, bytes=len(binario), modelos=indice), f, separators=(',', ':'), ensure_ascii=False)
    print('[dq] %s: %d modelos, %d bytes' % (familia, len(indice), len(binario)))


def limpiar_objetos():
    for o in list(bpy.data.objects):
        me = o.data; bpy.data.objects.remove(o)
        if isinstance(me, bpy.types.Mesh): bpy.data.meshes.remove(me)
