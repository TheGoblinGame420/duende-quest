# ═══════════════════════════════════════════════════════
# DUENDE QUEST — sprites 2D (CLASSIC) de los edificios de Blender
#
#   blender --background --factory-startup --python tools/blender/sprites2d.py -- <carpeta_salida> [px_por_metro=13] [alto_max=200]
#   (mas comodo: node tools/blender/sprites2d.mjs, que ademas arma el atlas en assets/2d/)
#
# Para cada edificio de modelos/edificios.py (nivel alto) saca, con camara ORTOGRAFICA de frente y 8° de
# elevacion (sol de arriba a la izquierda, como el resto del 2D):
#   <nombre>_dia.png   el edificio con las vidrieras apagadas (vidrio oscuro), fondo transparente
#   <nombre>_luz.png   solo lo que brilla de noche (vidrieras encendidas y fuego), el resto transparente
#   sprites.json       tamaño, fila del suelo y centros de las luces (en pixeles) de cada uno
# ═══════════════════════════════════════════════════════
import bpy, sys, os, math, json, runpy
import numpy as np
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import dq_lib as dq

args = sys.argv[sys.argv.index('--') + 1:]
SALIDA = os.path.abspath(args[0]); os.makedirs(SALIDA, exist_ok=True)
PXM = float(args[1]) if len(args) > 1 else 13.0
ALTO_MAX = float(args[2]) if len(args) > 2 else 200.0
ELEV = math.radians(8)
CUALES = ['casa_entramado', 'casa_mercader', 'herreria', 'casa_sabio', 'taberna', 'horno_abuela', 'casa_piedra']
VIDRIO_DIA = (0.018, 0.026, 0.04)

dq.limpiar()
dq.ESTRICTO[0] = False
runpy.run_path(os.path.join(AQUI, 'modelos', 'edificios.py'), run_name='dq_modelos')
sc = bpy.context.scene

# ── Luz y mundo comunes ──
sol = bpy.data.lights.new('sol', 'SUN'); sol.energy = 3.4; sol.angle = math.radians(8); sol.color = (1.0, 0.94, 0.84)
so = bpy.data.objects.new('sol', sol); sc.collection.objects.link(so)
# Desde la izquierda, de frente y desde arriba (la luz viene de -X, -Y, +Z).
d = np.array([-0.62, -0.55, 0.56]); d /= np.linalg.norm(d)
import mathutils
so.rotation_euler = mathutils.Vector((-d[0], -d[1], -d[2])).to_track_quat('-Z', 'Y').to_euler()
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs['Color'].default_value = (0.42, 0.44, 0.5, 1); bg.inputs['Strength'].default_value = 0.55
sc.render.engine = 'BLENDER_EEVEE'
try: sc.eevee.taa_render_samples = 32
except Exception: pass
sc.render.film_transparent = True
sc.view_settings.view_transform = 'Standard'
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'
co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
co.rotation_euler = (math.pi / 2 - ELEV, 0, 0)
DIR = np.array([0, math.cos(ELEV), -math.sin(ELEV)]); ARR = np.array([0, math.sin(ELEV), math.cos(ELEV)])

# ── Materiales: color horneado (dia) y solo lo que brilla (luz) ──
def mat_dia():
    m = bpy.data.materials.new('dia'); m.use_nodes = True
    nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_name = 'foto'
    nt.links.new(at.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 1.0
    for k in ('Specular IOR Level', 'Specular'):
        if k in b.inputs: b.inputs[k].default_value = 0.0
    return m
def mat_luz():
    m = bpy.data.materials.new('luz'); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    hold = nt.nodes.new('ShaderNodeHoldout'); em = nt.nodes.new('ShaderNodeEmission'); mix = nt.nodes.new('ShaderNodeMixShader')
    ac = nt.nodes.new('ShaderNodeAttribute'); ac.attribute_name = 'brillo'
    am = nt.nodes.new('ShaderNodeAttribute'); am.attribute_name = 'esluz'
    nt.links.new(ac.outputs['Color'], em.inputs['Color']); em.inputs['Strength'].default_value = 1.0
    nt.links.new(am.outputs['Fac'], mix.inputs['Fac'])
    nt.links.new(hold.outputs[0], mix.inputs[1]); nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return m
MDIA, MLUZ = mat_dia(), mat_luz()

meta = {'px_por_metro': PXM, 'elev': 8, 'sprites': {}}
for m in dq.MODELOS:
    if m['nombre'] not in CUALES: continue
    obj, _ = dq.construir(m, 0)[0]
    me = obj.data; me.calc_loop_triangles()
    cod = np.array([dq.MARCAS.get((x.name if x else 'dq_liso')[3:], 0) for x in me.materials] or [0])
    nt = len(me.loop_triangles)
    V = np.zeros(nt * 3, dtype=np.int32); me.loop_triangles.foreach_get('vertices', V); V = V.reshape(-1, 3)
    MI = np.zeros(nt, dtype=np.int32); me.loop_triangles.foreach_get('material_index', MI)
    mk = cod[MI]
    fa = me.attributes['foto']; F = np.zeros(len(me.vertices) * 4, dtype=np.float32); fa.data.foreach_get('color', F); F = F.reshape(-1, 4)
    P = dq.pos(obj)
    # Vidrio encendido (color vivo) y fuego (emisivo) = luces de noche.
    tri_vid = mk == dq.MARCAS['vidrio']; tri_emi = mk == dq.MARCAS['emisivo']
    vivo = F[:, :3].max(1) > 0.2
    v_vid = np.unique(V[tri_vid].ravel()); v_emi = np.unique(V[tri_emi].ravel())
    luz_v = np.zeros(len(P), dtype=np.float32)
    on = v_vid[vivo[v_vid]]; luz_v[on] = 1.0; luz_v[v_emi] = 1.0
    B = F.copy()
    B[on, :3] = np.clip(B[on, :3] * 1.6, 0, 1)
    # De dia todas las vidrieras son vidrio oscuro con un leve reflejo.
    F[v_vid, :3] = VIDRIO_DIA
    fa.data.foreach_set('color', F.ravel())
    ab = me.attributes.new('brillo', 'FLOAT_COLOR', 'POINT'); ab.data.foreach_set('color', B.ravel())
    al = me.attributes.new('esluz', 'FLOAT', 'POINT'); al.data.foreach_set('value', luz_v)
    me.attributes.active_color = fa
    # Encuadre: coordenadas de pantalla (X a la derecha, Y arriba) de todos los vertices.
    sx = P[:, 0]; sy = P @ ARR
    x0, x1 = sx.min(), sx.max(); y0, y1 = sy.min(), sy.max()
    esc = min(PXM, ALTO_MAX / max(y1 - y0, 1e-3))
    W = int(math.ceil((x1 - x0) * esc)) + 4; H = int(math.ceil((y1 - y0) * esc)) + 4
    cam.ortho_scale = max(W, H) / esc
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    c = np.array([cx, 0, 0]) + ARR * cy - DIR * 80
    co.location = tuple(c); cam.clip_end = 400
    sc.render.resolution_x = W; sc.render.resolution_y = H
    # Fila del suelo: el canto delantero de la base (z = 0, y = minimo).
    ysuelo = P[:, 1].min() * ARR[1]
    fila = (cy - ysuelo) * esc + H / 2
    # Centros de las luces: grupos de vertices encendidos, en pixeles.
    pts = []
    if len(on):
        Q = np.stack([(P[on, 0] - cx) * esc + W / 2, (cy - sy[on]) * esc + H / 2], 1)
        usado = np.zeros(len(Q), dtype=bool)
        for i in range(len(Q)):
            if usado[i]: continue
            cerca = (np.abs(Q[:, 0] - Q[i, 0]) < 7) & (np.abs(Q[:, 1] - Q[i, 1]) < 7) & ~usado
            usado |= cerca; g = Q[cerca].mean(0); pts.append([round(float(g[0]), 1), round(float(g[1]), 1)])
    # Render de dia y de luces.
    obj.data.materials.clear(); obj.data.materials.append(MDIA)
    sc.render.filepath = os.path.join(SALIDA, m['nombre'] + '_dia.png'); bpy.ops.render.render(write_still=True)
    obj.data.materials.clear(); obj.data.materials.append(MLUZ)
    sol.energy = 0.0; bg.inputs['Strength'].default_value = 0.0
    sc.render.filepath = os.path.join(SALIDA, m['nombre'] + '_luz.png'); bpy.ops.render.render(write_still=True)
    sol.energy = 3.4; bg.inputs['Strength'].default_value = 0.55
    meta['sprites'][m['nombre']] = {'w': W, 'h': H, 'suelo': round(float(fila), 1), 'luces': pts, 'esc': round(float(esc), 2)}
    print('[dq] sprite %-16s %dx%d suelo %.1f luces %d' % (m['nombre'], W, H, fila, len(pts)))
    bpy.data.objects.remove(obj, do_unlink=True)

with open(os.path.join(SALIDA, 'sprites.json'), 'w') as f: json.dump(meta, f, indent=1)
print('[dq] listo:', SALIDA)
