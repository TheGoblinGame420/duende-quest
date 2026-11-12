# ═══════════════════════════════════════════════════════
# DUENDE QUEST — foto de un modelo desde Blender (sin abrir el juego)
#
#   blender --background --factory-startup --python tools/blender/foto.py -- <familia> <modelo|todos> <salida.png> [opciones]
#   (mas comodo: node tools/blender/construir.mjs --foto <familia> <modelo|todos> <salida.png> [opciones])
#
# Un modelo: sus 3 niveles de detalle uno al lado del otro (alto, medio, bajo).
# «todos»: el nivel alto de cada modelo de la familia, en filas.
# Opciones: --giro=40 (grados)  --rapido (Workbench en vez de EEVEE)  --ancho=1600 --alto=900  --noche  --lod=0 (solo ese nivel)
# El color que se ve es el que exporta la biblioteca (color por vertice con la oclusion horneada; hojas con el verde
# de referencia o --tinte=#rrggbb) y las normales son las del juego.
# ═══════════════════════════════════════════════════════
import bpy, sys, os, math, runpy
import numpy as np
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import dq_lib as dq

args = sys.argv[sys.argv.index('--') + 1:]
pos_ = [a for a in args if not a.startswith('--')]
opt = {a[2:].split('=')[0]: (a.split('=', 1)[1] if '=' in a else True) for a in args if a.startswith('--')}
familia, cual, salida = pos_[0], pos_[1], os.path.abspath(pos_[2])

dq.limpiar()
dq.ESTRICTO[0] = False
runpy.run_path(os.path.join(AQUI, 'modelos', familia + '.py'), run_name='dq_modelos')
lista = dq.MODELOS if cual == 'todos' else [m for m in dq.MODELOS if m['nombre'] in cual.split(',')]
if not lista: raise SystemExit('no hay modelo «%s» en %s (hay: %s)' % (cual, familia, ', '.join(m['nombre'] for m in dq.MODELOS)))

tinte = dq.hexlin(opt['tinte']) if 'tinte' in opt else None
objs = []
x = 0.0; fila_y = 0.0; fila_alto = 0.0; en_fila = 0
por_fila = int(opt.get('fila', 6))
solo = int(opt['lod']) if 'lod' in opt else (0 if (cual == 'todos' or len(lista) > 1) else None)
for m in lista:
    niveles = [n for n in dq.construir(m, solo) if n]
    for obj, d in niveles:
        P = dq.pos(obj); mn = P.min(0); mx = P.max(0); ancho = max(mx[0] - mn[0], 1.0)
        if 'giro' in opt: dq.mover(obj, rot=(0, 0, math.radians(float(opt['giro'])))); P = dq.pos(obj); mn = P.min(0); mx = P.max(0); ancho = max(mx[0] - mn[0], 1.0)
        if tinte is not None:   # las hojas, con el color de zona pedido
            me = obj.data; a = me.attributes['foto']; F = np.zeros(len(me.vertices) * 4, dtype=np.float32); a.data.foreach_get('color', F); F = F.reshape(-1, 4)
            me.calc_loop_triangles(); cod = [dq.MARCAS.get(x_.name[3:], 0) for x_ in me.materials]
            for t in me.loop_triangles:
                if cod[t.material_index] == 1:
                    for v in t.vertices: F[v, 3] = 2.0
            h = F[:, 3] > 1.5; F[h, :3] = np.clip(F[h, :3] / dq.VERDE_REF * tinte, 0, 1); F[:, 3] = 1; a.data.foreach_set('color', F.ravel())
        dq.mover(obj, (x - mn[0], fila_y, 0)); x += ancho + 0.6; fila_alto = max(fila_alto, mx[2]); objs.append(obj)
    en_fila += 1
    if cual == 'todos' and en_fila >= por_fila: en_fila = 0; x = 0.0; fila_y += 9.0

# Material: el color exportado.
mat = bpy.data.materials.new('foto'); mat.use_nodes = True
nt = mat.node_tree; bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_name = 'foto'
nt.links.new(at.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 1.0
for k in ('Specular IOR Level', 'Specular'):
    if k in bsdf.inputs: bsdf.inputs[k].default_value = 0.0
for o in objs:
    o.data.materials.clear(); o.data.materials.append(mat)
    o.data.attributes.active_color = o.data.attributes['foto']

sc = bpy.context.scene
A = np.concatenate([dq.pos(o) for o in objs]); mn = A.min(0); mx = A.max(0); c = (mn + mx) / 2
suelo = dq.primitiva('cubo', 'suelo', lado=1.0); dq.mover(suelo, (c[0], c[1], -0.5), esc=(400, 400, 1))
ms = bpy.data.materials.new('suelo'); ms.use_nodes = True
bs = next(n for n in ms.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); bs.inputs['Base Color'].default_value = (0.10, 0.13, 0.07, 1) if 'noche' not in opt else (0.03, 0.04, 0.05, 1); bs.inputs['Roughness'].default_value = 1
suelo.data.materials.clear(); suelo.data.materials.append(ms)

sol = bpy.data.lights.new('sol', 'SUN'); sol.energy = 3.2 if 'noche' not in opt else 0.5; sol.angle = math.radians(3)
sol.color = (1.0, 0.95, 0.86) if 'noche' not in opt else (0.6, 0.7, 1.0)
so = bpy.data.objects.new('sol', sol); sc.collection.objects.link(so); so.rotation_euler = (math.radians(52), 0, math.radians(35))
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs['Color'].default_value = (0.46, 0.6, 0.8, 1) if 'noche' not in opt else (0.02, 0.03, 0.06, 1); bg.inputs['Strength'].default_value = 0.9

W = int(opt.get('ancho', 1600)); H = int(opt.get('alto', 900))
cam = bpy.data.cameras.new('cam'); cam.lens = 60; co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
sc.render.resolution_x = W; sc.render.resolution_y = H
alto_v = (mx[2] - mn[2]) + (mx[1] - mn[1]) * 0.3; ancho_v = mx[0] - mn[0]
dist = max(ancho_v / (2 * math.tan(cam.angle_x / 2)), alto_v / (2 * math.tan(cam.angle_y / 2))) * 1.12 + (mx[1] - mn[1]) / 2
elev = math.radians(float(opt.get('elev', 12)))
co.location = (c[0], c[1] - dist * math.cos(elev), c[2] + dist * math.sin(elev))
co.rotation_euler = (math.pi / 2 - elev, 0, 0)
cam.clip_end = 2000
sc.render.resolution_x = W; sc.render.resolution_y = H; sc.render.filepath = salida
sc.view_settings.view_transform = 'Standard'
if 'rapido' in opt:
    sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'VERTEX'; sh.show_shadows = True; sh.show_cavity = False
else:
    sc.render.engine = 'BLENDER_EEVEE'
    try: sc.eevee.taa_render_samples = 24
    except Exception: pass
bpy.ops.render.render(write_still=True)
print('[dq] foto:', salida)
