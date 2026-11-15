# Chacra de Chicha Wars modelada en Blender: parcela, cultivos por etapa y el fondo de pasto.
#   blender -b -P tools/cw_chacra_blender.py -- carpeta_salida [muestras]
# Saca parcela.png, cul_brote.png, cul_<cultivo>_1.png (creciendo), cul_<cultivo>_2.png (listo) y chacra_fondo.png.
# Parcela y cultivos comparten camara (ortografica, 30° de elevacion) y encuadre: en el juego se apilan tal cual.
import bpy, math, sys, random
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SALIDA = argv[0]; MUESTRAS = int(argv[1]) if len(argv) > 1 else 64
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def hexa(h):
    h = h.lstrip('#'); return tuple(pow(int(h[i:i + 2], 16) / 255, 2.2) for i in (0, 2, 4))
def mat(nombre, color, rug=0.7, emis=None, fuerza=0.0):
    m = bpy.data.materials.new(nombre); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF'); b.inputs['Base Color'].default_value = (*hexa(color), 1); b.inputs['Roughness'].default_value = rug
    if emis: b.inputs['Emission Color'].default_value = (*hexa(emis), 1); b.inputs['Emission Strength'].default_value = fuerza
    return m
# Color con manchas de ruido entre dos tonos (tierra, pasto, cascara de piña).
def mat_ruido(nombre, c1, c2, escala, rug=0.9, relieve=0.0, voronoi=False):
    m = bpy.data.materials.new(nombre); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes.get('Principled BSDF'); b.inputs['Roughness'].default_value = rug
    tc = nt.nodes.new('ShaderNodeTexCoord')
    if voronoi: ru = nt.nodes.new('ShaderNodeTexVoronoi'); ru.inputs['Scale'].default_value = escala; sal = ru.outputs['Distance']
    else: ru = nt.nodes.new('ShaderNodeTexNoise'); ru.inputs['Scale'].default_value = escala; ru.inputs['Detail'].default_value = 6; sal = ru.outputs[0]
    nt.links.new(tc.outputs['Object'], ru.inputs['Vector'])
    cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].position = 0.3; cr.color_ramp.elements[0].color = (*hexa(c1), 1); cr.color_ramp.elements[1].position = 0.7; cr.color_ramp.elements[1].color = (*hexa(c2), 1)
    nt.links.new(sal, cr.inputs['Fac']); nt.links.new(cr.outputs['Color'], b.inputs['Base Color'])
    if relieve:
        bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = relieve; nt.links.new(sal, bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m

M_TIERRA = mat_ruido('tierra', '#4a2f1d', '#6e4a2c', 9.0, 1.0, 0.7)
M_SURCO = mat_ruido('surco', '#5a3a22', '#7a5433', 14.0, 1.0, 0.5)
M_TRONCO = mat_ruido('tronco', '#6b4526', '#8a5f38', 5.0, 0.85, 0.3)
M_TABLA = mat_ruido('tabla', '#8a5a34', '#b07a48', 4.0, 0.7, 0.2)
M_V1 = mat('verde1', '#4f9a3c', 0.6); M_V2 = mat('verde2', '#6fbf4a', 0.6); M_V3 = mat('verde3', '#2f7a36', 0.6); M_VP = mat('verdepina', '#5f9a7a', 0.6)
M_MORADO = mat('morado', '#5a1a6e', 0.4); M_PANCA = mat('panca', '#d9c98a', 0.8); M_ESPIGA = mat('espiga', '#e0c070', 0.8)
M_PINA = mat_ruido('pina', '#b8660f', '#f2b01e', 16.0, 0.6, 1.0, voronoi=True)
M_LIMON = mat('limon', '#e8e23a', 0.45); M_MANZ = mat('manzana', '#d7261e', 0.35); M_CANELA = mat('canela', '#9a5326', 0.75); M_CANELA2 = mat('canela2', '#c97a3e', 0.75)
M_ROJIZO = mat('rojizo', '#b5533a', 0.6); M_CANA = mat('cana', '#c9c24a', 0.5); M_CANA2 = mat('cana2', '#7fae3f', 0.5); M_NUDO = mat('nudo', '#7a6a2a', 0.7)

def col(nombre):
    c = bpy.data.collections.new(nombre); sc.collection.children.link(c); return c
def pon(c):
    o = bpy.context.active_object
    for u in list(o.users_collection): u.objects.unlink(o)
    c.objects.link(o); return o
def cubo(c, pos, tam, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos); o = pon(c); o.scale = tam; o.rotation_euler = rot; o.data.materials.append(m); return o
def cil(c, pos, r, alto, m, rot=(0, 0, 0), v=14, r2=None):
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=alto, location=pos)
    else: bpy.ops.mesh.primitive_cone_add(vertices=v, radius1=r, radius2=r2, depth=alto, location=pos)
    o = pon(c); o.rotation_euler = rot; o.data.materials.append(m); bpy.ops.object.shade_smooth(); return o
def esf(c, pos, r, m, esc=(1, 1, 1), rot=(0, 0, 0), ico=False):
    if ico: bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=r, location=pos)
    else: bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=pos, segments=18, ring_count=12)
    o = pon(c); o.scale = esc; o.rotation_euler = rot; o.data.materials.append(m)
    if ico: bpy.ops.object.shade_flat()
    else: bpy.ops.object.shade_smooth()
    return o
# Hoja larga: una tira que sale de `base` hacia el angulo `az`, sube y luego cae en arco.
def hoja(c, base, az, largo, ancho, sube, cae, m, n=8):
    vs, fs = [], []
    dx, dy = math.cos(az), math.sin(az); px, py = -dy, dx
    for i in range(n + 1):
        u = i / n; d = u * largo; z = sube * u - cae * u * u; w = ancho * math.sin(math.pi * (0.12 + 0.88 * u)) * 0.5 + 0.004
        cx, cy, cz = base[0] + dx * d, base[1] + dy * d, base[2] + z
        vs += [(cx - px * w, cy - py * w, cz - 0.02 * math.sin(math.pi * u)), (cx, cy, cz + 0.015), (cx + px * w, cy + py * w, cz - 0.02 * math.sin(math.pi * u))]
        if i: a = (i - 1) * 3; fs += [(a, a + 3, a + 4, a + 1), (a + 1, a + 4, a + 5, a + 2)]
    me = bpy.data.meshes.new('hoja'); me.from_pydata(vs, [], fs); me.update()
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new('hoja', me); c.objects.link(o); o.data.materials.append(m)
    so = o.modifiers.new('g', 'SOLIDIFY'); so.thickness = 0.012
    return o

VERDES = [M_V1, M_V2, M_V3]
# ── parcela: cama de tierra con surcos y marco de troncos ──
C_PAR = col('parcela')
cubo(C_PAR, (0, 0, 0.09), (2.05, 1.55, 0.18), M_TIERRA)
for i in range(4): cil(C_PAR, (0, -0.56 + i * 0.375, 0.17), 0.12, 1.95, M_SURCO, rot=(0, math.pi / 2, 0), v=10)
for sy in (-0.82, 0.82): cil(C_PAR, (0, sy, 0.13), 0.11, 2.36, M_TRONCO, rot=(0, math.pi / 2, 0))
for sx in (-1.08, 1.08): cil(C_PAR, (sx, 0, 0.13), 0.11, 1.86, M_TRONCO, rot=(math.pi / 2, 0, 0))
for sx in (-1.08, 1.08):
    for sy in (-0.82, 0.82): cil(C_PAR, (sx, sy, 0.19), 0.13, 0.38, M_TABLA)

# ── brote (igual para todos) ──
C_BRO = col('cul_brote')
for bx in (-0.5, 0, 0.5):
    esf(C_BRO, (bx, 0, 0.22), 0.16, M_SURCO, (1.2, 1.0, 0.5))
    cil(C_BRO, (bx, 0, 0.36), 0.018, 0.2, M_V2, v=6)
    for az in (0.3, 3.4): hoja(C_BRO, (bx, 0, 0.44), az, 0.22, 0.13, 0.12, 0.06, M_V2, n=5)

# ── maiz morado ──
def maiz(c, x, alto, mazorcas):
    cil(c, (x, 0, alto / 2 + 0.15), 0.045, alto, M_V1, v=8)
    n = 5 + int(alto * 2)
    for i in range(n):
        z = 0.3 + (alto - 0.25) * i / n; az = i * 2.4 + x * 3
        hoja(c, (x, 0, z), az, 0.55 + 0.25 * random.random(), 0.16, 0.42, 0.55, VERDES[i % 3])
    if mazorcas:
        for k, (z, az) in enumerate([(alto * 0.5, -1.1), (alto * 0.68, -2.2)]):
            dx, dy = math.cos(az) * 0.12, math.sin(az) * 0.12
            esf(c, (x + dx, dy, z + 0.15), 0.1, M_MORADO, (1, 1, 2.5), rot=(0.35 * math.sin(az), -0.35 * math.cos(az), 0))
            hoja(c, (x + dx * 0.6, dy * 0.6, z - 0.08), az, 0.3, 0.2, 0.42, 0.1, M_PANCA, n=5)
        for i in range(7): cil(c, (x + 0.07 * math.cos(i), 0.07 * math.sin(i), alto + 0.28), 0.012, 0.3, M_ESPIGA, rot=(0.35 * math.sin(i), 0.35 * math.cos(i), 0), v=5)
C = col('cul_maiz_1'); [maiz(C, bx, 1.0, False) for bx in (-0.55, 0, 0.55)]
C = col('cul_maiz_2'); [maiz(C, bx, 1.85 + 0.1 * (bx == 0), True) for bx in (-0.55, 0, 0.55)]

# ── piña ──
def pina(c, x, s, fruto):
    for i in range(14):
        az = i * 2.399; lv = 0.25 + 0.55 * (i % 3) / 2
        hoja(c, (x, 0, 0.2), az, (0.75 - lv * 0.25) * s, 0.13 * s, (0.25 + lv) * s, 0.35 * s, M_VP if i % 2 else M_V3)
    if fruto:
        esf(c, (x, 0, 0.2 + 0.62 * s), 0.25 * s, M_PINA, (1, 1, 1.35))
        for i in range(9): hoja(c, (x, 0, 0.2 + 0.9 * s), i * 2.399, 0.3 * s, 0.09 * s, 0.34 * s, 0.14 * s, M_V1 if i % 2 else M_VP, n=5)
C = col('cul_pina_1'); [pina(C, bx, 0.8, False) for bx in (-0.5, 0.5)]
C = col('cul_pina_2'); [pina(C, bx, 1.0, True) for bx in (-0.5, 0.5)]

# ── arbolitos de limon y manzana ──
def arbol(c, s, hojas, fruta, r_fruta, tronco_h):
    cil(c, (0, 0, 0.15 + tronco_h * s / 2), 0.09 * s, tronco_h * s, M_TRONCO, r2=0.06 * s)
    cz = 0.15 + tronco_h * s
    bolas = [(0, 0, 0.42, 0.62), (-0.42, 0.05, 0.25, 0.46), (0.42, -0.05, 0.22, 0.46), (0.05, -0.3, 0.2, 0.44), (-0.15, 0.3, 0.5, 0.42), (0.2, 0.1, 0.72, 0.4)]
    for i, (bx, by, bz, br) in enumerate(bolas): esf(c, (bx * s, by * s, cz + bz * s), br * s, hojas[i % len(hojas)], ico=True)
    if fruta:
        random.seed(3)
        for i in range(9):
            az = -math.pi / 2 + random.uniform(-1.25, 1.25); el = random.uniform(-0.25, 1.0); rr = 0.66 * s
            esf(c, (math.cos(az) * math.cos(el) * rr, math.sin(az) * math.cos(el) * rr * 0.8, cz + 0.4 * s + math.sin(el) * rr * 0.8), r_fruta, fruta)
C = col('cul_limon_1'); arbol(C, 0.7, [M_V2, M_V1], None, 0, 0.5)
C = col('cul_limon_2'); arbol(C, 1.0, [M_V2, M_V1], M_LIMON, 0.085, 0.6)
C = col('cul_manzana_1'); arbol(C, 0.78, [M_V3, M_V1], None, 0, 0.7)
C = col('cul_manzana_2'); arbol(C, 1.12, [M_V3, M_V1], M_MANZ, 0.1, 0.8)

# ── canela: arbusto de ramas rojizas; lista = con rajas de canela al pie ──
def canela(c, s, lista):
    random.seed(8)
    for i in range(5):
        az = i * 1.257 + 0.3; inc = 0.28; h = (1.1 + 0.3 * (i % 2)) * s
        bx, by = math.cos(az) * 0.16, math.sin(az) * 0.16
        cil(c, (bx + math.cos(az) * inc * h / 2, by + math.sin(az) * inc * h / 2, 0.15 + h / 2), 0.035, h, M_CANELA, rot=(-inc * math.sin(az), inc * math.cos(az), 0), v=7)
        for j in range(5):
            u = 0.3 + 0.7 * j / 4; z = 0.15 + h * u; cx, cy = bx + math.cos(az) * inc * h * u, by + math.sin(az) * inc * h * u
            for lado in (1.2, -1.2): hoja(c, (cx, cy, z), az + lado, 0.34 * s, 0.17 * s, 0.14, 0.12, M_ROJIZO if j == 4 else VERDES[(i + j) % 3], n=5)
    if lista:
        for i in range(5): cil(c, (-0.55 + i * 0.07, -0.55, 0.3 + (i % 2) * 0.06), 0.045, 0.55, M_CANELA2 if i % 2 else M_CANELA, rot=(0, math.pi / 2, 0.25), v=8)
        cil(c, (-0.42, -0.58, 0.33), 0.11, 0.05, M_PANCA, rot=(0, math.pi / 2, 0.25), v=10)
C = col('cul_canela_1'); canela(C, 0.65, False)
C = col('cul_canela_2'); canela(C, 1.0, True)

# ── caña de azucar ──
def cana(c, alto, madura):
    random.seed(4)
    for i in range(7):
        bx = -0.6 + i * 0.2; by = 0.12 * math.sin(i * 2.1); inc = 0.1 * math.sin(i * 1.7); h = alto * (0.85 + 0.3 * random.random())
        m = (M_CANA if i % 2 else M_CANA2) if madura else M_CANA2
        cil(c, (bx + inc * h / 2, by, 0.15 + h / 2), 0.05, h, m, rot=(0, inc, 0), v=8)
        if madura:
            for k in range(1, int(h / 0.28)): cil(c, (bx + inc * k * 0.28, by, 0.15 + k * 0.28), 0.056, 0.03, M_NUDO, rot=(0, inc, 0), v=8)
        for j in range(5): hoja(c, (bx + inc * h, by, 0.15 + h - 0.1), j * 1.3 + i, 0.6, 0.1, 0.5, 0.5, VERDES[(i + j) % 3], n=6)
C = col('cul_azucar_1'); cana(C, 0.95, False)
C = col('cul_azucar_2'); cana(C, 1.75, True)

# ── fondo de la chacra: pasto con matas, flores, piedras y cerca arriba ──
C_F = col('chacra_fondo')
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0)); pon(C_F).data.materials.append(mat_ruido('pasto', '#5f9e3e', '#86bf52', 1.4, 1.0, 0.15))
random.seed(21)
M_FLOR = [mat('f' + str(i), h, 0.6) for i, h in enumerate(['#ffd23f', '#ff6fa3', '#ffffff', '#b06cf0'])]
M_ROCA = mat_ruido('roca', '#8d8a80', '#b9b5a8', 6.0, 0.9, 0.5)
# matas y flores en una sola malla por material (miles de bpy.ops serian lentisimos)
def malla(nombre, m, vs, fs):
    me = bpy.data.meshes.new(nombre); me.from_pydata(vs, [], fs); me.update(); o = bpy.data.objects.new(nombre, me); C_F.objects.link(o); o.data.materials.append(m)
for k in range(3):
    vs, fs = [], []
    for i in range(520):
        px, py = random.uniform(-9, 9), random.uniform(-10, 8)
        for j in range(3):
            bx, by, h, r = px + random.uniform(-0.1, 0.1), py + random.uniform(-0.1, 0.1), random.uniform(0.2, 0.4), 0.045
            n = len(vs); vs += [(bx - r, by - r, 0), (bx + r, by - r, 0), (bx, by + r, 0), (bx + random.uniform(-0.08, 0.08), by + random.uniform(-0.08, 0.08), h)]
            fs += [(n, n + 1, n + 3), (n + 1, n + 2, n + 3), (n + 2, n, n + 3)]
    malla('matas' + str(k), VERDES[k], vs, fs)
for k in range(4):
    vs, fs = [], []
    for i in range(22):
        px, py, r = random.uniform(-9, 9), random.uniform(-10, 8), 0.075
        n = len(vs); vs += [(px - r, py, 0.24), (px, py - r, 0.24), (px + r, py, 0.24), (px, py + r, 0.24), (px, py, 0.31), (px, py, 0.0)]
        fs += [(n, n + 1, n + 4), (n + 1, n + 2, n + 4), (n + 2, n + 3, n + 4), (n + 3, n, n + 4), (n, n + 1, n + 5), (n + 1, n + 2, n + 5), (n + 2, n + 3, n + 5), (n + 3, n, n + 5)]
    malla('flores' + str(k), M_FLOR[k], vs, fs)
for i in range(16):
    px, py = random.uniform(-9, 9), random.uniform(-10, 8); esf(C_F, (px, py, 0.03), random.uniform(0.12, 0.26), M_ROCA, (1.2, 1, 0.6), ico=True)
# cerca de palos al fondo y franja de tierra del camino
cubo(C_F, (0, 7.9, 0.01), (30, 1.6, 0.02), M_TIERRA)
for i in range(31):
    px = -9.75 + i * 0.65; cil(C_F, (px, 6.9, 0.45), 0.07, 0.9, M_TRONCO, v=8)
    if i < 30:
        for z in (0.35, 0.68): cil(C_F, (px + 0.325, 6.9, z), 0.04, 0.7, M_TABLA, rot=(0, math.pi / 2, 0), v=6)

# ── luz, camaras y render ──
bpy.ops.object.light_add(type='SUN', location=(0, 0, 20)); s = bpy.context.active_object
s.rotation_euler = (math.radians(50), 0, math.radians(-32)); s.data.energy = 3.8; s.data.color = (1.0, 0.95, 0.86); s.data.angle = math.radians(5)
w = bpy.data.worlds.new('amb'); sc.world = w; w.use_nodes = True
w.node_tree.nodes.get('Background').inputs['Color'].default_value = (0.78, 0.88, 1.0, 1); w.node_tree.nodes.get('Background').inputs['Strength'].default_value = 1.1
cam = bpy.data.cameras.new('cam'); co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
cam.type = 'ORTHO'; cam.clip_end = 200
def mira(objetivo, elev, dist=40):
    e = math.radians(elev); co.location = (objetivo[0], objetivo[1] - dist * math.cos(e), objetivo[2] + dist * math.sin(e)); co.rotation_euler = (math.pi / 2 - e, 0, 0)
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = MUESTRAS; sc.cycles.use_denoising = True
sc.view_settings.view_transform = 'Standard'
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'; sc.render.resolution_percentage = 100
TODAS = [c for c in sc.collection.children]
def render(nombre, visibles):
    for c in TODAS:
        for o in c.objects: o.hide_render = c.name not in visibles
    sc.render.filepath = SALIDA + '/' + nombre + '.png'; bpy.ops.render.render(write_still=True)
# parcela y cultivos: mismo encuadre de 3,0 × 3,0 unidades
sc.render.film_transparent = True; sc.render.resolution_x = 384; sc.render.resolution_y = 384; cam.ortho_scale = 3.0; mira((0, 0, 0.98), 30)
for c in TODAS:
    if c.name != 'chacra_fondo': render(c.name, [c.name])
# fondo: mas cenital, opaco
sc.render.film_transparent = False; sc.render.resolution_x = 1080; sc.render.resolution_y = 900; cam.ortho_scale = 15.0; mira((0, 0.6, 0), 52)
render('chacra_fondo', ['chacra_fondo'])
print('LISTO')
