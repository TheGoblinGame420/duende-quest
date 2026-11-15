# ═══════════════════════════════════════════════════════
# DUENDE QUEST — sprites 2D (CLASSIC) del decorado: arboles, rocas, ruinas y objetos del pueblo
#
#   blender --background --factory-startup --python tools/blender/sprites2d_deco.py -- <familia> <modelo,modelo,...> <carpeta_salida> [px_por_metro=13] [alto_max=200]
#   (mas comodo: node tools/blender/sprites2d_deco.mjs, que ademas arma los atlas en assets/2d/)
#
# Igual que sprites2d.py (casas): camara ORTOGRAFICA de frente con 8° de elevacion y sol de arriba a la izquierda.
# Para cada modelo (nivel alto) saca:
#   <nombre>_dia.png   el modelo de dia; las HOJAS van en gris (su multiplicador): el juego las tiñe con el verde
#                      de cada zona usando la mascara de abajo
#   <nombre>_luz.png   solo lo que brilla de noche (vidrio encendido y fuego), el resto transparente
#   <nombre>_hoja.png  mascara de las hojas que se ven (blanco), el resto transparente
#   sprites.json       tamaño, fila del suelo, luces (pixeles) y si tiene hojas o luces
# Las tarjetas de follaje se recortan con la textura de follaje de arboles.py; los «carteles» (racimos que en el
# juego siempre miran a la camara) se abren aqui como cuadrados de frente.
# ═══════════════════════════════════════════════════════
import bpy, sys, os, math, json, runpy
import numpy as np
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import dq_lib as dq
import mathutils

args = sys.argv[sys.argv.index('--') + 1:]
FAMILIA = args[0]
CUALES = [x for x in args[1].split(',') if x]
SALIDA = os.path.abspath(args[2]); os.makedirs(SALIDA, exist_ok=True)
PXM = float(args[3]) if len(args) > 3 else 13.0
ALTO_MAX = float(args[4]) if len(args) > 4 else 200.0
ELEV = math.radians(8)
VIDRIO_DIA = (0.018, 0.026, 0.04)
GRIS_HOJA = 0.62          # las hojas de dia: multiplicador × esto (el juego multiplica por el tinte de la zona)
NUCLEO = 0.62            # la masa interior de la copa, algo mas oscura (como en el juego)

dq.limpiar()
dq.ESTRICTO[0] = False
runpy.run_path(os.path.join(AQUI, 'modelos', FAMILIA + '.py'), run_name='dq_modelos')
sc = bpy.context.scene
faltan = [c for c in CUALES if c not in [m['nombre'] for m in dq.MODELOS]]
if faltan: raise SystemExit('no hay en %s: %s' % (FAMILIA, ', '.join(faltan)))

# ── Luz, mundo y camara (los mismos que las casas) ──
sol = bpy.data.lights.new('sol', 'SUN'); sol.energy = 3.4; sol.angle = math.radians(8); sol.color = (1.0, 0.94, 0.84)
so = bpy.data.objects.new('sol', sol); sc.collection.objects.link(so)
d = np.array([-0.62, -0.55, 0.56]); d /= np.linalg.norm(d)
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

# ── Textura de follaje (si la familia la registra): R = recorte, B = claro/oscuro ──
TEX = None
if 'follaje' in dq.TEXTURAS:
    # Se escribe como PNG (igual que assets/3d/dq_follaje.png) y se carga: arriba del PNG = v 1, como en el juego.
    A = np.clip(np.asarray(dq.TEXTURAS['follaje'](), dtype=np.float32), 0, 1)
    ruta_tex = os.path.join(SALIDA, '_follaje.png'); dq.guardar_png(ruta_tex, A)
    TEX = bpy.data.images.load(ruta_tex); TEX.colorspace_settings.name = 'Non-Color'
    print('[dq] textura de follaje %dx%d, recorte medio %.2f' % (TEX.size[0], TEX.size[1], float(A[:, :, 0].mean())))

def _hojas_tex(nt, salida_alfa):
    """Nodos: muestra la textura de follaje en 'duv'; devuelve (alfa = recorte, tono = 0.55..1.25)."""
    at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_name = 'duv'
    im = nt.nodes.new('ShaderNodeTexImage'); im.image = TEX; im.interpolation = 'Linear'; im.extension = 'EXTEND'
    nt.links.new(at.outputs['Vector'], im.inputs['Vector'])
    sp = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(im.outputs['Color'], sp.inputs['Color'])
    gt = nt.nodes.new('ShaderNodeMath'); gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = 0.5
    nt.links.new(sp.outputs[0], gt.inputs[0])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = 0.55; mr.inputs['To Max'].default_value = 1.25
    nt.links.new(sp.outputs[2], mr.inputs['Value'])
    return gt.outputs[0], mr.outputs['Result']

def mat_dia(tarjeta=False):
    m = bpy.data.materials.new('dia_t' if tarjeta else 'dia'); m.use_nodes = True
    nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_name = 'foto'
    b.inputs['Roughness'].default_value = 1.0
    for k in ('Specular IOR Level', 'Specular'):
        if k in b.inputs: b.inputs[k].default_value = 0.0
    if tarjeta and TEX is not None:
        alfa, tono = _hojas_tex(nt, True)
        mu = nt.nodes.new('ShaderNodeVectorMath'); mu.operation = 'SCALE'
        nt.links.new(at.outputs['Color'], mu.inputs[0]); nt.links.new(tono, mu.inputs['Scale'])
        nt.links.new(mu.outputs[0], b.inputs['Base Color']); nt.links.new(alfa, b.inputs['Alpha'])
        try: m.surface_render_method = 'DITHERED'
        except Exception: pass
        try: m.blend_method = 'CLIP'
        except Exception: pass
    else:
        nt.links.new(at.outputs['Color'], b.inputs['Base Color'])
    return m

def mat_emite(attr_color, attr_fac, tarjeta=False, nombre='luz'):
    """Emision donde attr_fac = 1 y holdout (tapa sin pintar) en el resto."""
    m = bpy.data.materials.new(nombre + ('_t' if tarjeta else '')); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    hold = nt.nodes.new('ShaderNodeHoldout'); em = nt.nodes.new('ShaderNodeEmission'); mix = nt.nodes.new('ShaderNodeMixShader')
    am = nt.nodes.new('ShaderNodeAttribute'); am.attribute_name = attr_fac
    if attr_color:
        ac = nt.nodes.new('ShaderNodeAttribute'); ac.attribute_name = attr_color; nt.links.new(ac.outputs['Color'], em.inputs['Color'])
    else: em.inputs['Color'].default_value = (1, 1, 1, 1)
    em.inputs['Strength'].default_value = 1.0
    nt.links.new(am.outputs['Fac'], mix.inputs['Fac'])
    nt.links.new(hold.outputs[0], mix.inputs[1]); nt.links.new(em.outputs[0], mix.inputs[2])
    if tarjeta and TEX is not None:
        # Fuera del recorte de la hoja: transparente (ni tapa ni pinta).
        alfa, _ = _hojas_tex(nt, True)
        tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx2 = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(alfa, mx2.inputs['Fac']); nt.links.new(tr.outputs[0], mx2.inputs[1]); nt.links.new(mix.outputs[0], mx2.inputs[2])
        nt.links.new(mx2.outputs[0], out.inputs['Surface'])
        try: m.surface_render_method = 'DITHERED'
        except Exception: pass
    else:
        nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return m

MDIA, MDIA_T = mat_dia(), mat_dia(True)
MLUZ, MLUZ_T = mat_emite('brillo', 'esluz'), mat_emite('brillo', 'esluz', True)
MHOJ, MHOJ_T = mat_emite(None, 'eshoja', nombre='hoja'), mat_emite(None, 'eshoja', True, nombre='hoja')

def poner(obj, a, b, tarjetas):
    """Material a en las caras normales y b en las tarjetas (indice 1). Vaciar los materiales borra los indices:
    se vuelven a poner despues."""
    me = obj.data; me.materials.clear(); me.materials.append(a); me.materials.append(b)
    me.polygons.foreach_set('material_index', tarjetas.astype(np.int32)); me.update()

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
    # ── Carteles: 4 vertices en el mismo punto → cuadrado de frente con el racimo hacia fuera de la copa ──
    tri_fr = mk == dq.MARCAS['fronda']
    if tri_fr.any() and 'duv' in me.attributes:
        UV = np.zeros(len(P) * 2, dtype=np.float32); me.attributes['duv'].data.foreach_get('vector', UV); UV = UV.reshape(-1, 2)
        Wv = np.zeros(len(P), dtype=np.float32)
        if 'viento' in me.attributes: me.attributes['viento'].data.foreach_get('value', Wv)
        NS = np.zeros(len(P) * 3, dtype=np.float32)
        if 'nesf' in me.attributes: me.attributes['nesf'].data.foreach_get('vector', NS)
        NS = NS.reshape(-1, 3)
        abiertos = 0
        plano = [t for t in np.where(tri_fr)[0] if np.ptp(P[V[t]], axis=0).max() <= 1e-5]   # las tarjetas normales ya tienen forma
        for v in (np.unique(V[plano].ravel()) if plano else []):
            tam = dq.CARTEL_MIN + dq.CARTEL_PASO * round(float(Wv[v]) * 15)
            n = NS[v]; dx, dy = float(n[0]), float(n @ ARR)
            l = math.hypot(dx, dy)
            dx, dy = (dx / l, dy / l) if l > 0.2 else (0.0, 1.0)
            sube = (np.array([1.0, 0, 0]) * dx + ARR * dy) * tam
            lado = (np.array([1.0, 0, 0]) * dy - ARR * dx) * tam / 2
            cu, cv = UV[v]; fu = (cu % 0.5) / 0.5; fv = (cv % 0.5) / 0.5
            P[v] = P[v] - sube * 0.3 + lado * (1 if fu > 0.5 else -1) + sube * (1 if fv > 0.5 else 0)
            abiertos += 1
        if abiertos: me.vertices.foreach_set('co', P.ravel()); me.update()
        print('[dq] %s: %d vertices de carteles abiertos' % (m['nombre'], abiertos))
    # ── Luces de noche (vidrio encendido y fuego) ──
    tri_vid = mk == dq.MARCAS['vidrio']; tri_emi = mk == dq.MARCAS['emisivo']
    vivo = F[:, :3].max(1) > 0.2
    v_vid = np.unique(V[tri_vid].ravel()); v_emi = np.unique(V[tri_emi].ravel())
    luz_v = np.zeros(len(P), dtype=np.float32)
    on = v_vid[vivo[v_vid]] if len(v_vid) else v_vid; luz_v[on] = 1.0; luz_v[v_emi] = 1.0
    on = np.unique(np.concatenate([on, v_emi])).astype(np.int64)
    B = F.copy(); B[on, :3] = np.clip(B[on, :3] * 1.6, 0, 1)
    if len(v_vid): F[v_vid, :3] = VIDRIO_DIA
    # ── Hojas: de dia en gris (multiplicador), y su mascara ──
    tri_hoja = np.isin(mk, dq.HOJAS)
    v_hoja = np.unique(V[tri_hoja].ravel()).astype(np.int64)
    hoja_v = np.zeros(len(P), dtype=np.float32); hoja_v[v_hoja] = 1.0
    if len(v_hoja):
        g = (F[v_hoja, :3] / dq.VERDE_REF).mean(1) * GRIS_HOJA
        v_nuc = np.unique(V[mk == dq.MARCAS['nucleo']].ravel()).astype(np.int64)
        F[v_hoja, :3] = np.clip(g, 0, 1)[:, None]
        if len(v_nuc): F[v_nuc, :3] *= NUCLEO
    fa.data.foreach_set('color', F.ravel())
    me.attributes.new('brillo', 'FLOAT_COLOR', 'POINT').data.foreach_set('color', B.ravel())
    me.attributes.new('esluz', 'FLOAT', 'POINT').data.foreach_set('value', luz_v)
    me.attributes.new('eshoja', 'FLOAT', 'POINT').data.foreach_set('value', hoja_v)
    me.attributes.active_color = fa
    # Material por cara: 0 normal, 1 tarjeta de follaje.
    pol_fr = np.array([cod[p.material_index] == dq.MARCAS['fronda'] for p in me.polygons], dtype=bool)
    # ── Encuadre ──
    sx = P[:, 0]; sy = P @ ARR
    x0, x1 = sx.min(), sx.max(); y0, y1 = sy.min(), sy.max()
    esc = min(PXM, ALTO_MAX / max(y1 - y0, 1e-3))
    W = int(math.ceil((x1 - x0) * esc)) + 4; H = int(math.ceil((y1 - y0) * esc)) + 4
    cam.ortho_scale = max(W, H) / esc
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    c = np.array([cx, 0, 0]) + ARR * cy - DIR * 80
    co.location = tuple(c); cam.clip_end = 400
    sc.render.resolution_x = W; sc.render.resolution_y = H
    # Pie del modelo: su origen (x = 0, y = 0, z = 0), en pixeles del sprite (columna y fila).
    fila = cy * esc + H / 2
    pie = (0 - cx) * esc + W / 2
    pts = []
    if len(on):
        Q = np.stack([(P[on, 0] - cx) * esc + W / 2, (cy - sy[on]) * esc + H / 2], 1)
        usado = np.zeros(len(Q), dtype=bool)
        for i in range(len(Q)):
            if usado[i]: continue
            cerca = (np.abs(Q[:, 0] - Q[i, 0]) < 7) & (np.abs(Q[:, 1] - Q[i, 1]) < 7) & ~usado
            usado |= cerca; gq = Q[cerca].mean(0); pts.append([round(float(gq[0]), 1), round(float(gq[1]), 1)])
    base = os.path.join(SALIDA, m['nombre'])
    poner(obj, MDIA, MDIA_T, pol_fr); sc.render.filepath = base + '_dia.png'; bpy.ops.render.render(write_still=True)
    sol.energy = 0.0; bg.inputs['Strength'].default_value = 0.0
    if len(on): poner(obj, MLUZ, MLUZ_T, pol_fr); sc.render.filepath = base + '_luz.png'; bpy.ops.render.render(write_still=True)
    if len(v_hoja): poner(obj, MHOJ, MHOJ_T, pol_fr); sc.render.filepath = base + '_hoja.png'; bpy.ops.render.render(write_still=True)
    sol.energy = 3.4; bg.inputs['Strength'].default_value = 0.55
    meta['sprites'][m['nombre']] = {'w': W, 'h': H, 'suelo': round(float(fila), 1), 'pie': round(float(pie), 1), 'luces': pts, 'esc': round(float(esc), 2), 'luz': bool(len(on)), 'hoja': bool(len(v_hoja))}
    print('[dq] sprite %-18s %dx%d suelo %.1f luces %d hojas %d' % (m['nombre'], W, H, fila, len(pts), len(v_hoja)))
    bpy.data.objects.remove(obj, do_unlink=True)

with open(os.path.join(SALIDA, 'sprites.json'), 'w') as f: json.dump(meta, f, indent=1)
print('[dq] listo:', SALIDA)
