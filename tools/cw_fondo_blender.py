# Fondo de Chicha Wars modelado en Blender: plaza de pueblo andino con casas, iglesia y cordillera.
#   blender -b -P tools/cw_fondo_blender.py -- salida.png dia|noche [muestras]
# Camara pensada para la escena del juego (540x640, el piso empieza en y=360): el horizonte cae en y≈336.
import bpy, bmesh, math, random, sys
from mathutils import Vector, noise

argv = sys.argv[sys.argv.index('--') + 1:]
SALIDA, MODO = argv[0], argv[1]
MUESTRAS = int(argv[2]) if len(argv) > 2 else 96
NOCHE = MODO == 'noche'
random.seed(11)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# ── materiales ──
def mat(nombre, color, rug=0.85, emis=None, fuerza=0.0):
    m = bpy.data.materials.new(nombre); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rug
    if emis:
        b.inputs['Emission Color'].default_value = (*emis, 1); b.inputs['Emission Strength'].default_value = fuerza
    return m

def hexa(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(pow(v, 2.2) for v in c)

M_TEJA = [mat('teja' + str(i), hexa(c), 0.9) for i, c in enumerate(['#b5532e', '#a8452a', '#c0623a', '#8f3d26'])]
M_PARED = [mat('pared' + str(i), hexa(c), 0.95) for i, c in enumerate(['#f3e7d0', '#e9c98f', '#d99a5b', '#f6f1e6', '#e3b27a', '#c9d8c0', '#e7b7a0', '#f0d9a8'])]
M_MADERA = mat('madera', hexa('#5a3620'), 0.8)
M_PUERTA = [mat('puerta' + str(i), hexa(c), 0.7) for i, c in enumerate(['#2f6f8f', '#1f5a46', '#7a3b22', '#3b4a8a'])]
M_ZOCALO = mat('zocalo', hexa('#8a5a3c'), 0.95)
M_VENTANA = mat('ventana', hexa('#22304a'), 0.3, hexa('#ffb347') if NOCHE else None, 7.0 if NOCHE else 0)
M_VENT_OFF = mat('ventana_off', hexa('#1b2438'), 0.3)
M_TRONCO = mat('tronco', hexa('#6b4a2f'), 0.9)
M_HOJA = [mat('hoja' + str(i), hexa(c), 0.9) for i, c in enumerate(['#3f7d3a', '#4f9444', '#2f6a35'])]
M_PIEDRA = mat('piedra', hexa('#b9a58c'), 0.9)
M_FAROL = mat('farol', hexa('#2b2b33'), 0.5)
M_LUZ = mat('luz', hexa('#fff0c0'), 0.4, hexa('#ffc266'), 40.0 if NOCHE else 1.5)
M_FLOR = [mat('flor' + str(i), hexa(c), 0.8) for i, c in enumerate(['#e0457b', '#f2b233', '#d7392f', '#8e44ad'])]

# Suelo empedrado: celdas de Voronoi con juntas oscuras y relieve.
def mat_suelo():
    m = bpy.data.materials.new('suelo'); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes.get('Principled BSDF'); b.inputs['Roughness'].default_value = 0.9
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1.0, 0.75, 1.0)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    v1 = nt.nodes.new('ShaderNodeTexVoronoi'); v1.feature = 'DISTANCE_TO_EDGE'; v1.inputs['Scale'].default_value = 2.6
    v2 = nt.nodes.new('ShaderNodeTexVoronoi'); v2.feature = 'F1'; v2.inputs['Scale'].default_value = 2.6
    nt.links.new(mp.outputs['Vector'], v1.inputs['Vector']); nt.links.new(mp.outputs['Vector'], v2.inputs['Vector'])
    junta = nt.nodes.new('ShaderNodeValToRGB'); junta.color_ramp.elements[0].position = 0.02; junta.color_ramp.elements[1].position = 0.09
    junta.color_ramp.elements[0].color = (*hexa('#6b4a34'), 1); junta.color_ramp.elements[1].color = (1, 1, 1, 1)
    nt.links.new(v1.outputs['Distance'], junta.inputs['Fac'])
    tono = nt.nodes.new('ShaderNodeValToRGB')
    tono.color_ramp.elements[0].color = (*hexa('#c79b70'), 1); tono.color_ramp.elements[1].color = (*hexa('#e6c79c'), 1)
    sep = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(v2.outputs['Color'], sep.inputs['Color']); nt.links.new(sep.outputs[0], tono.inputs['Fac'])
    mz = nt.nodes.new('ShaderNodeMix'); mz.data_type = 'RGBA'; mz.blend_type = 'MULTIPLY'; mz.inputs[0].default_value = 1.0
    nt.links.new(tono.outputs['Color'], mz.inputs[6]); nt.links.new(junta.outputs['Color'], mz.inputs[7]); nt.links.new(mz.outputs[2], b.inputs['Base Color'])
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.55; bp.inputs['Distance'].default_value = 0.03
    nt.links.new(junta.outputs['Color'], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m

# Montaña: roca azulada con nieve arriba (segun la altura) y borde irregular.
def mat_monte(base, nieve_desde, tinte):
    m = bpy.data.materials.new('monte'); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes.get('Principled BSDF'); b.inputs['Roughness'].default_value = 1.0
    geo = nt.nodes.new('ShaderNodeNewGeometry'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'], sep.inputs['Vector'])
    ru = nt.nodes.new('ShaderNodeTexNoise'); ru.inputs['Scale'].default_value = 0.09; ru.inputs['Detail'].default_value = 6
    suma = nt.nodes.new('ShaderNodeMath'); suma.operation = 'MULTIPLY_ADD'; suma.inputs[1].default_value = 16.0
    nt.links.new(ru.outputs[0], suma.inputs[0]); nt.links.new(sep.outputs['Z'], suma.inputs[2])
    rg = nt.nodes.new('ShaderNodeMapRange'); rg.inputs['From Min'].default_value = nieve_desde; rg.inputs['From Max'].default_value = nieve_desde + 3.0
    nt.links.new(suma.outputs[0], rg.inputs['Value'])
    cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].color = (*base, 1); cr.color_ramp.elements[1].color = (*tinte, 1)
    nt.links.new(rg.outputs['Result'], cr.inputs['Fac']); nt.links.new(cr.outputs['Color'], b.inputs['Base Color'])
    return m

def cubo(nombre, pos, tam, m, padre=None, rz=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o = bpy.context.active_object; o.name = nombre; o.scale = tam; o.rotation_euler[2] = rz
    o.data.materials.append(m)
    if padre: o.parent = padre
    return o

def techo(pos, w, d, alto, m, padre, alero=0.35):
    # Prisma triangular a dos aguas, cumbrera a lo largo de X.
    w2, d2 = w / 2 + alero, d / 2 + alero
    v = [(-w2, -d2, 0), (w2, -d2, 0), (w2, d2, 0), (-w2, d2, 0), (-w2, 0, alto), (w2, 0, alto)]
    f = [(0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)]
    me = bpy.data.meshes.new('techo'); me.from_pydata(v, [], f); me.update()
    o = bpy.data.objects.new('techo', me); sc.collection.objects.link(o); o.location = pos; o.data.materials.append(m); o.parent = padre
    return o

def casa(x, y, w, d, h, rz=0.0, pisos=None):
    e = bpy.data.objects.new('casa', None); sc.collection.objects.link(e); e.location = (x, y, 0); e.rotation_euler[2] = rz
    pared = random.choice(M_PARED); pisos = pisos or (2 if h > 3.6 else 1)
    cubo('muro', (0, 0, h / 2), (w, d, h), pared, e)
    cubo('zocalo', (0, -0.03, 0.3), (w + 0.06, d + 0.02, 0.6), M_ZOCALO, e)
    techo((0, 0, h), w, d, random.uniform(0.9, 1.5), random.choice(M_TEJA), e)
    fy = -d / 2 - 0.04; hp = h / pisos
    # puerta
    px = random.uniform(-w * 0.25, w * 0.25)
    cubo('marco', (px, fy, 1.05), (1.15, 0.08, 2.1), M_MADERA, e); cubo('puerta', (px, fy - 0.03, 1.0), (0.9, 0.08, 1.95), random.choice(M_PUERTA), e)
    # ventanas (algunas apagadas de noche)
    n = max(2, int(w / 1.6))
    for p in range(pisos):
        for i in range(n):
            vx = -w / 2 + (i + 0.5) * w / n; vz = p * hp + hp * 0.58
            if p == 0 and abs(vx - px) < 1.0: continue
            mv = M_VENTANA if (not NOCHE or random.random() < 0.65) else M_VENT_OFF
            cubo('marcoV', (vx, fy, vz), (0.95, 0.08, 1.15), M_MADERA, e); cubo('vidrio', (vx, fy - 0.03, vz), (0.72, 0.08, 0.92), mv, e)
            if p == 1 and random.random() < 0.6:   # balcon con flores
                cubo('balcon', (vx, fy - 0.3, vz - 0.72), (1.2, 0.55, 0.1), M_MADERA, e)
                cubo('baranda', (vx, fy - 0.55, vz - 0.42), (1.2, 0.05, 0.5), M_MADERA, e)
                cubo('flores', (vx, fy - 0.5, vz - 0.12), (1.0, 0.2, 0.18), random.choice(M_FLOR), e)
    return e

def arbol(x, y, s=1.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.16 * s, depth=2.2 * s, location=(x, y, 1.1 * s)); bpy.context.active_object.data.materials.append(M_TRONCO)
    for i in range(4):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=random.uniform(0.8, 1.2) * s, location=(x + random.uniform(-0.6, 0.6) * s, y + random.uniform(-0.4, 0.4) * s, (2.4 + random.uniform(0, 1.3)) * s))
        o = bpy.context.active_object; o.data.materials.append(random.choice(M_HOJA)); bpy.ops.object.shade_flat()

def farol(x, y):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=3.2, location=(x, y, 1.6)); bpy.context.active_object.data.materials.append(M_FAROL)
    cubo('brazo', (x, y, 3.25), (0.5, 0.08, 0.08), M_FAROL)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.2, location=(x, y, 3.05)); bpy.context.active_object.data.materials.append(M_LUZ)
    if NOCHE:
        bpy.ops.object.light_add(type='POINT', location=(x, y - 0.3, 2.9)); l = bpy.context.active_object.data
        l.energy = 900; l.color = (1.0, 0.72, 0.38); l.shadow_soft_size = 0.4

def monte(x, y, radio, alto, material, semilla):
    bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=radio, radius2=0, depth=alto, location=(x, y, alto / 2 - 1))
    o = bpy.context.active_object
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.subdivide(number_cuts=14); bpy.ops.object.mode_set(mode='OBJECT')
    for v in o.data.vertices:
        p = o.matrix_world @ v.co
        n = noise.fractal(Vector((p.x * 0.035 + semilla, p.y * 0.035, p.z * 0.035)), 1.0, 2.0, 5)
        k = max(0.0, 1 - (v.co.z + alto / 2) / alto)       # menos ruido cerca de la cumbre
        v.co.x += n * radio * 0.22 * (0.3 + k); v.co.y += n * radio * 0.22 * (0.3 + k); v.co.z += n * alto * 0.10
    o.data.materials.append(material); bpy.ops.object.shade_flat()
    return o

# ── escena ──
bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 60, 0)); bpy.context.active_object.data.materials.append(mat_suelo())

# fila del fondo de la plaza (frente a la camara) e iglesia
x = -19.0
while x < 19:
    w = random.uniform(3.4, 5.2); h = random.choice([3.2, 3.4, 4.8, 5.2, 5.6])
    if not (-9.5 < x + w / 2 < -3.0): casa(x + w / 2, 8.5 + random.uniform(-0.2, 0.2), w, 5, h)
    x += w + 0.05
# iglesia blanca con dos torres
ig = bpy.data.objects.new('iglesia', None); sc.collection.objects.link(ig); ig.location = (-6.2, 10.5, 0)
M_BLANCO = mat('cal', hexa('#f7f2e8'), 0.95)
cubo('nave', (0, 0, 3.4), (5.2, 7, 6.8), M_BLANCO, ig); techo((0, 0, 6.8), 5.2, 7, 1.6, M_TEJA[0], ig).rotation_euler[2] = math.pi / 2
cubo('porton', (0, -3.56, 1.6), (1.7, 0.1, 3.2), M_PUERTA[2], ig); cubo('arco', (0, -3.54, 3.3), (2.1, 0.1, 0.35), M_PIEDRA, ig)
cubo('roseton', (0, -3.56, 4.9), (1.0, 0.1, 1.0), M_VENTANA, ig)
for sx in (-3.3, 3.3):
    cubo('torre', (sx, -2.6, 4.6), (2.0, 2.0, 9.2), M_BLANCO, ig)
    cubo('campana', (sx, -3.62, 7.7), (0.8, 0.1, 1.3), M_VENT_OFF, ig); cubo('cornisa', (sx, -2.6, 9.25), (2.3, 2.3, 0.22), M_PIEDRA, ig)
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=1.55, radius2=0, depth=2.2, location=(0, 0, 0)); c = bpy.context.active_object
    c.rotation_euler[2] = math.pi / 4; c.data.materials.append(M_TEJA[1]); c.parent = ig; c.location = (sx, -2.6, 10.45)
# casas a los lados (cierran la plaza en perspectiva)
for lado in (-1, 1):
    y = -6.0
    while y < 6.5:
        w = random.uniform(3.6, 5.0)
        casa(lado * 11.2, y + w / 2, w, 4.5, random.choice([3.4, 5.0, 5.4]), rz=-lado * math.pi / 2)
        y += w + 0.05
# arboles, faroles y pileta
for ax, ay, s in [(-13.5, 5.5, 1.5), (13.2, 5.8, 1.4), (-2.4, 7.2, 0.9), (3.6, 7.0, 1.0), (16.5, 2, 1.6), (-16.5, 2.5, 1.6)]: arbol(ax, ay, s)
for fx, fy in [(-7.2, 3.2), (7.2, 3.2), (-9.0, -3.0), (9.0, -3.0)]: farol(fx, fy)
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=1.6, depth=0.6, location=(0.6, 4.6, 0.3)); bpy.context.active_object.data.materials.append(M_PIEDRA)
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=1.35, depth=0.1, location=(0.6, 4.6, 0.58)); bpy.context.active_object.data.materials.append(mat('agua', hexa('#4aa3c7'), 0.1))
bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.22, depth=1.6, location=(0.6, 4.6, 1.2)); bpy.context.active_object.data.materials.append(M_PIEDRA)
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.7, depth=0.14, location=(0.6, 4.6, 1.95)); bpy.context.active_object.data.materials.append(M_PIEDRA)

# cerros verdes con andenes y cordillera nevada (mas azul cuanto mas lejos)
VERDE = [hexa('#6f9a4f'), hexa('#86a85a'), hexa('#5d8a55')]
for i, (mx, my, r, a) in enumerate([(-34, 44, 26, 13), (30, 46, 28, 15), (-6, 58, 34, 12), (58, 60, 30, 17), (-62, 58, 30, 16)]):
    monte(mx, my, r, a, mat_monte(VERDE[i % 3], 99, VERDE[i % 3]), i * 3.1)
for i, (mx, my, r, a) in enumerate([(-70, 150, 62, 62), (-18, 165, 70, 78), (44, 150, 60, 66), (100, 160, 64, 58), (-125, 160, 60, 54), (10, 210, 90, 70)]):
    lejos = (my - 140) / 80
    roca = tuple(v * (1 - 0.35 * lejos) + c * 0.35 * lejos for v, c in zip(hexa('#5f7396'), hexa('#a9c3e0')))
    monte(mx, my, r, a, mat_monte(roca, a * 0.66, hexa('#ffffff')), 20 + i * 5.7)

# ── luz y cielo ──
bpy.ops.object.light_add(type='SUN', location=(0, 0, 30)); sol = bpy.context.active_object
sol.rotation_euler = (math.radians(52), 0, math.radians(-38))
sol.data.energy = 0.18 if NOCHE else 4.2; sol.data.color = (0.55, 0.68, 1.0) if NOCHE else (1.0, 0.93, 0.80); sol.data.angle = math.radians(3)
w = bpy.data.worlds.new('cielo'); sc.world = w; w.use_nodes = True; nt = w.node_tree
bg = nt.nodes.get('Background'); tc = nt.nodes.new('ShaderNodeTexCoord'); sp = nt.nodes.new('ShaderNodeSeparateXYZ'); cr = nt.nodes.new('ShaderNodeValToRGB')
nt.links.new(tc.outputs['Generated'], sp.inputs['Vector']); nt.links.new(sp.outputs['Z'], cr.inputs['Fac'])
e = cr.color_ramp.elements
if NOCHE:
    e[0].position = 0.0; e[0].color = (*hexa('#3b2f73'), 1); e[1].position = 0.45; e[1].color = (*hexa('#0b0f2e'), 1)
    st = nt.nodes.new('ShaderNodeTexVoronoi'); st.inputs['Scale'].default_value = 260.0
    sr = nt.nodes.new('ShaderNodeValToRGB'); sr.color_ramp.elements[0].position = 0.0; sr.color_ramp.elements[0].color = (9, 9, 8, 1); sr.color_ramp.elements[1].position = 0.035; sr.color_ramp.elements[1].color = (0, 0, 0, 1)
    nt.links.new(tc.outputs['Generated'], st.inputs['Vector']); nt.links.new(st.outputs['Distance'], sr.inputs['Fac'])
    ad = nt.nodes.new('ShaderNodeMix'); ad.data_type = 'RGBA'; ad.blend_type = 'ADD'; ad.inputs[0].default_value = 1.0
    nt.links.new(cr.outputs['Color'], ad.inputs[6]); nt.links.new(sr.outputs['Color'], ad.inputs[7]); nt.links.new(ad.outputs[2], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 0.35
else:
    e[0].position = 0.0; e[0].color = (*hexa('#ffe6b8'), 1); e[1].position = 0.42; e[1].color = (*hexa('#4f9fdc'), 1)
    nt.links.new(cr.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 1.15

# ── camara y render ──
cam = bpy.data.cameras.new('cam'); co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
co.location = (0, -13.5, 2.5); co.rotation_euler = (math.radians(86.8), 0, 0); cam.lens = 30; cam.clip_end = 600
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = MUESTRAS; sc.cycles.use_denoising = True
sc.render.resolution_x = 1080; sc.render.resolution_y = 1280; sc.render.resolution_percentage = 100
sc.view_settings.view_transform = 'Standard'
try: sc.view_settings.look = 'Medium High Contrast'
except Exception: pass
sc.render.image_settings.file_format = 'PNG'; sc.render.filepath = SALIDA
bpy.ops.render.render(write_still=True)
print('LISTO', SALIDA)
