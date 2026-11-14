# Puesto de chicha modelado en Blender, en capas con fondo transparente:
#   blender -b -P tools/cw_puesto_blender.py -- carpeta_salida
# Saca puesto_toldo_0/1/2.png (postes + toldo, detras de los clientes) y puesto_mostrador.png (delante).
# Camara ortografica inclinada 15°. 1 unidad = 54 px logicos; la imagen cubre el rectangulo (0, 70, 540, 315) de la escena.
import bpy, math, sys, random

SALIDA = sys.argv[sys.argv.index('--') + 1]
random.seed(5)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def hexa(h):
    h = h.lstrip('#'); return tuple(pow(int(h[i:i + 2], 16) / 255, 2.2) for i in (0, 2, 4))

def mat(nombre, color, rug=0.8, emis=None, fuerza=0.0, metal=0.0):
    m = bpy.data.materials.new(nombre); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF'); b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rug; b.inputs['Metallic'].default_value = metal
    if emis: b.inputs['Emission Color'].default_value = (*emis, 1); b.inputs['Emission Strength'].default_value = fuerza
    return m

# Franjas segun un eje del mundo (X: toldo; Z: manta andina).
def mat_franjas(nombre, colores, eje, frec, rug=0.9):
    m = bpy.data.materials.new(nombre); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes.get('Principled BSDF'); b.inputs['Roughness'].default_value = rug
    geo = nt.nodes.new('ShaderNodeNewGeometry'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'], sep.inputs['Vector'])
    mu = nt.nodes.new('ShaderNodeMath'); mu.operation = 'MULTIPLY'; mu.inputs[1].default_value = frec; nt.links.new(sep.outputs[eje], mu.inputs[0])
    fr = nt.nodes.new('ShaderNodeMath'); fr.operation = 'FRACT'; nt.links.new(mu.outputs[0], fr.inputs[0])
    cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.interpolation = 'CONSTANT'
    e = cr.color_ramp.elements; e[0].position = 0; e[0].color = (*hexa(colores[0]), 1); e[1].position = 1 / len(colores); e[1].color = (*hexa(colores[1]), 1)
    for i in range(2, len(colores)): n = e.new(i / len(colores)); n.color = (*hexa(colores[i]), 1)
    nt.links.new(fr.outputs[0], cr.inputs['Fac']); nt.links.new(cr.outputs['Color'], b.inputs['Base Color'])
    return m

# Madera con vetas (ruido estirado) y tablones.
def mat_madera(nombre, claro, oscuro, tablones=0.0):
    m = bpy.data.materials.new(nombre); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes.get('Principled BSDF'); b.inputs['Roughness'].default_value = 0.7
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1.5, 1.5, 14.0)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    ru = nt.nodes.new('ShaderNodeTexNoise'); ru.inputs['Scale'].default_value = 3.0; ru.inputs['Detail'].default_value = 5; nt.links.new(mp.outputs['Vector'], ru.inputs['Vector'])
    cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].position = 0.35; cr.color_ramp.elements[0].color = (*hexa(oscuro), 1); cr.color_ramp.elements[1].position = 0.7; cr.color_ramp.elements[1].color = (*hexa(claro), 1)
    nt.links.new(ru.outputs[0], cr.inputs['Fac']); sal = cr.outputs['Color']
    if tablones:
        geo = nt.nodes.new('ShaderNodeNewGeometry'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'], sep.inputs['Vector'])
        mu = nt.nodes.new('ShaderNodeMath'); mu.operation = 'MULTIPLY'; mu.inputs[1].default_value = tablones; nt.links.new(sep.outputs['X'], mu.inputs[0])
        fr = nt.nodes.new('ShaderNodeMath'); fr.operation = 'FRACT'; nt.links.new(mu.outputs[0], fr.inputs[0])
        ju = nt.nodes.new('ShaderNodeValToRGB'); ju.color_ramp.elements[0].position = 0.0; ju.color_ramp.elements[0].color = (0.25, 0.2, 0.18, 1); ju.color_ramp.elements[1].position = 0.06; ju.color_ramp.elements[1].color = (1, 1, 1, 1)
        nt.links.new(fr.outputs[0], ju.inputs['Fac'])
        mz = nt.nodes.new('ShaderNodeMix'); mz.data_type = 'RGBA'; mz.blend_type = 'MULTIPLY'; mz.inputs[0].default_value = 1.0
        nt.links.new(sal, mz.inputs[6]); nt.links.new(ju.outputs['Color'], mz.inputs[7]); sal = mz.outputs[2]
    nt.links.new(sal, b.inputs['Base Color'])
    return m

M_POSTE = mat_madera('poste', '#9a6a3c', '#6b4424')
M_TABLA = mat_madera('tabla', '#8a5a34', '#5e3a20', tablones=1.6)
M_TAPA = mat_madera('tapa', '#c79258', '#9a6a3c')
M_ORO = mat('oro', hexa('#e3b23c'), 0.35, metal=0.8)
M_MAIZ = mat('maiz', hexa('#4a1452'), 0.45)
M_PANCA = mat('panca', hexa('#d9c48a'), 0.9)
M_SOGA = mat('soga', hexa('#6b4a2f'), 0.9)
M_MANTA = mat_franjas('manta', ['#c62828', '#fdd835', '#2e7d32', '#1565c0', '#8e24aa', '#ef6c00', '#00838f', '#ad1457'], 'Z', 2.2)
M_FOCO = mat('foco', hexa('#fff3c4'), 0.3, hexa('#ffc266'), 6.0)
BANDERIN = [mat('b' + str(i), hexa(c), 0.8) for i, c in enumerate(['#e53935', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'])]

def nueva(nombre):
    c = bpy.data.collections.new(nombre); sc.collection.children.link(c); return c
def a(col):
    o = bpy.context.active_object
    for c in list(o.users_collection): c.objects.unlink(o)
    col.objects.link(o); return o
def cubo(col, pos, tam, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos); o = a(col); o.scale = tam; o.rotation_euler = rot; o.data.materials.append(m); return o
def cil(col, pos, r, alto, m, rot=(0, 0, 0), v=20, liso=True):
    bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=alto, location=pos); o = a(col); o.rotation_euler = rot; o.data.materials.append(m)
    if liso: bpy.ops.object.shade_smooth()
    return o
def esfera(col, pos, r, m, esc=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=pos, segments=16, ring_count=10); o = a(col); o.scale = esc; o.data.materials.append(m); bpy.ops.object.shade_smooth(); return o

# ── postes y armazon (comun a los tres toldos) ──
C_BASE = nueva('base')
for sx in (-4.45, 4.45):
    cil(C_BASE, (sx, 0.5, 2.65), 0.12, 5.3, M_POSTE)
    cubo(C_BASE, (sx, 0.5, 0.12), (0.42, 0.42, 0.24), M_TABLA)
cil(C_BASE, (0, 0.5, 5.3), 0.09, 9.1, M_POSTE, rot=(0, math.pi / 2, 0))
# mazorcas de maiz morado colgadas
for sx in (-3.55, 3.55):
    for i in range(3):
        px = sx + (i - 1) * 0.3; pz = 3.55 - (i % 2) * 0.18
        cil(C_BASE, (px, 0.3, pz + 0.75), 0.012, 1.1, M_SOGA, v=6)
        esfera(C_BASE, (px, 0.3, pz), 0.13, M_MAIZ, (1, 1, 2.6))
        esfera(C_BASE, (px, 0.3, pz + 0.36), 0.1, M_PANCA, (1.2, 1.2, 0.9))

# ── toldos ──
def toldo(col, colores, frec):
    m = mat_franjas('tela' + col.name, colores, 'X', frec)
    # lona inclinada con un poco de comba
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=40, y_subdivisions=8, size=1, location=(0, 0, 0)); o = a(col)
    for v in o.data.vertices:
        u, w = v.co.x + 0.5, v.co.y + 0.5            # 0..1
        v.co.x = (u - 0.5) * 9.7; v.co.y = -1.25 + w * 1.95
        v.co.z = 4.8 + w * 0.55 - 0.07 * math.sin(math.pi * w) - 0.05 * math.sin(math.pi * u)
    o.data.materials.append(m); bpy.ops.object.shade_smooth()
    so = o.modifiers.new('grosor', 'SOLIDIFY'); so.thickness = 0.04
    # cenefa con ondas: banda recta + discos
    cubo(col, (0, -1.31, 4.68), (9.7, 0.03, 0.26), m)
    n = 12
    for i in range(n):
        cx = -4.85 + (i + 0.5) * 9.7 / n
        cil(col, (cx, -1.27, 4.56), 9.7 / n / 2, 0.03, m, rot=(math.pi / 2, 0, 0), v=28, liso=False)
    cubo(col, (0, -1.35, 4.80), (9.74, 0.04, 0.05), M_ORO)

C_T1 = nueva('toldo1'); toldo(C_T1, ['#c62828', '#fafafa'], 12 / 9.7 / 2 * 1.0)
C_T2 = nueva('toldo2'); toldo(C_T2, ['#7b1fa2', '#fdd835'], 12 / 9.7 / 2 * 1.0)
# toldo de fiesta: banderines y foquitos en catenaria
for i in range(15):
    u = (i + 0.5) / 15; px = -4.3 + u * 8.6; pz = 4.1 - math.sin(u * math.pi) * 0.42
    me = bpy.data.meshes.new('ban'); me.from_pydata([(-0.17, 0, 0), (0.17, 0, 0), (0, 0, -0.36)], [], [(0, 1, 2)]); me.update()
    o = bpy.data.objects.new('ban', me); C_T2.objects.link(o); o.location = (px, -1.42, pz); o.data.materials.append(BANDERIN[i % 5])
for i in range(40):
    u = i / 39; px = -4.3 + u * 8.6; pz = 4.1 - math.sin(u * math.pi) * 0.42
    bpy.ops.mesh.primitive_cube_add(size=1, location=(px, -1.42, pz + 0.01)); o = a(C_T2); o.scale = (0.24, 0.015, 0.015); o.data.materials.append(M_SOGA)
for i in range(9):
    u = (i + 0.5) / 9; px = -4.2 + u * 8.4
    esfera(C_T2, (px, -1.45, 4.3), 0.07, M_FOCO)

# ── mostrador ──
C_MOS = nueva('mostrador')
cubo(C_MOS, (0, 0, 0.55), (9.5, 1.0, 1.1), M_TABLA)
cubo(C_MOS, (0, -0.03, 1.16), (9.86, 1.22, 0.13), M_TAPA)
cubo(C_MOS, (0, -0.66, 1.16), (9.9, 0.04, 0.15), M_ORO)
cubo(C_MOS, (0, -0.59, 0.09), (9.3, 0.05, 0.18), M_POSTE)
for sx in (-4.72, 4.72): cubo(C_MOS, (sx, -0.02, 0.56), (0.16, 1.06, 1.12), M_POSTE)
# manta andina tejida colgando al frente, con flecos
cubo(C_MOS, (0, -0.53, 0.82), (7.6, 0.035, 0.56), M_MANTA)
for i in range(60):
    px = -3.78 + i * 7.56 / 59
    cubo(C_MOS, (px, -0.535, 0.49), (0.05, 0.02, 0.12), M_PANCA)

# ── luz, camara y render ──
bpy.ops.object.light_add(type='SUN', location=(0, 0, 20)); s = bpy.context.active_object
s.rotation_euler = (math.radians(48), 0, math.radians(-28)); s.data.energy = 3.6; s.data.color = (1.0, 0.94, 0.84); s.data.angle = math.radians(4)
w = bpy.data.worlds.new('amb'); sc.world = w; w.use_nodes = True
w.node_tree.nodes.get('Background').inputs['Color'].default_value = (0.75, 0.85, 1.0, 1); w.node_tree.nodes.get('Background').inputs['Strength'].default_value = 1.0
T = math.radians(15); cs, sn = math.cos(T), math.sin(T); C = 2.545
cam = bpy.data.cameras.new('cam'); co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
cam.type = 'ORTHO'; cam.ortho_scale = 10.0; cam.clip_end = 100
co.location = (0, C * sn - 30 * cs, C * cs + 30 * sn); co.rotation_euler = (math.radians(75), 0, 0)
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 72; sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.render.resolution_x = 1080; sc.render.resolution_y = 630; sc.render.resolution_percentage = 100
sc.view_settings.view_transform = 'Standard'
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
CAPAS = {'puesto_toldo_0': [C_BASE], 'puesto_toldo_1': [C_BASE, C_T1], 'puesto_toldo_2': [C_BASE, C_T2], 'puesto_mostrador': [C_MOS]}
for nombre, visibles in CAPAS.items():
    for c in (C_BASE, C_T1, C_T2, C_MOS):
        for o in c.objects: o.hide_render = c not in visibles
    sc.render.filepath = SALIDA + '/' + nombre + '.png'
    bpy.ops.render.render(write_still=True)
print('LISTO')
