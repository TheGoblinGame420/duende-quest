# Arma un atlas de sprites 2D del decorado (lo llama sprites2d_deco.mjs; Python del sistema con PIL).
#   python tools/blender/sprites2d_deco_atlas.py <salida_sin_extension> <carpeta_de_sprites2d_deco.py> [carpeta ...]
# Banda 1: los modelos de dia (algo desaturados, como las casas). Si alguno brilla de noche, banda de luces debajo
# (mismas x); si alguno tiene hojas, banda con su mascara (mismas x). El JSON dice en que fila empieza cada banda.
# JSON: { alto, filas: {luz, hoja} (null si no hay), s: {nombre: {x, w, h, suelo, pie, luces, hoja?, luz?}} }
import sys, json, os
from PIL import Image, ImageEnhance

out, srcs = sys.argv[1], sys.argv[2:]
items = []
for src in srcs:
    for nom, v in json.load(open(os.path.join(src, 'sprites.json')))['sprites'].items(): items.append((src, nom, v))
SEP = 2
W = sum(v['w'] + SEP for _, _, v in items); H = max(v['h'] for _, _, v in items)
hay_luz = any(v.get('luz') for _, _, v in items); hay_hoja = any(v.get('hoja') for _, _, v in items)
filas = {'luz': None, 'hoja': None}; y = H + SEP
if hay_luz: filas['luz'] = y; y += H + SEP
if hay_hoja: filas['hoja'] = y; y += H + SEP
atlas = Image.new('RGBA', (W, y - SEP), (0, 0, 0, 0))
res = {'alto': H, 'filas': filas, 's': {}}
x = 0
for src, nom, v in items:
    d = Image.open(os.path.join(src, nom + '_dia.png')).convert('RGBA')
    a = d.split()[3]
    rgb = ImageEnhance.Color(d.convert('RGB')).enhance(0.72)
    rgb = ImageEnhance.Brightness(rgb).enhance(0.9)
    d2 = rgb.convert('RGBA'); d2.putalpha(a)
    atlas.alpha_composite(d2, (x, 0))
    e = {'x': x, 'w': v['w'], 'h': v['h'], 'suelo': round(v['suelo']), 'pie': round(v.get('pie', v['w'] / 2))}
    vis = []
    if v.get('luz'):
        l = Image.open(os.path.join(src, nom + '_luz.png')).convert('RGBA'); atlas.alpha_composite(l, (x, filas['luz']))
        # Luces que se ven de frente (alfa en la capa de luz), agrupadas a 10 px.
        la = l.split()[3]
        for px, py in v['luces']:
            ok = any(la.getpixel((min(l.width - 1, max(0, int(px) + dx)), min(l.height - 1, max(0, int(py) + dy)))) > 40 for dx in (-1, 0, 1) for dy in (-1, 0, 1))
            if ok and all(abs(px - q[0]) > 10 or abs(py - q[1]) > 10 for q in vis): vis.append([round(px), round(py)])
        e['luz'] = 1
    if v.get('hoja'):
        atlas.alpha_composite(Image.open(os.path.join(src, nom + '_hoja.png')).convert('RGBA'), (x, filas['hoja'])); e['hoja'] = 1
    e['luces'] = vis
    res['s'][nom] = e
    x += v['w'] + SEP
atlas.save(out + '.webp', 'WEBP', quality=86, method=6, alpha_quality=90)
with open(out + '.json', 'w', encoding='utf-8') as f: json.dump(res, f, separators=(',', ':'))
print('atlas', os.path.basename(out), atlas.size, os.path.getsize(out + '.webp'), 'bytes;', len(res['s']), 'sprites')
