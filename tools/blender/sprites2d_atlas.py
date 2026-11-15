# Arma el atlas de los sprites 2D de edificios (lo llama sprites2d.mjs; Python del sistema con PIL).
#   python tools/blender/sprites2d_atlas.py <carpeta_de_sprites2d.py> <salida_sin_extension>
# Fila 1: edificios de dia (algo desaturados para la paleta «medieval místico»). Fila 2, mismas x: solo luces.
# JSON: por edificio x, w, h, suelo (fila del pie dentro del sprite) y luces visibles [x, y] relativas al sprite.
import sys, json, os
from PIL import Image, ImageEnhance

src, out = sys.argv[1], sys.argv[2]
meta = json.load(open(os.path.join(src, 'sprites.json')))['sprites']
SEP = 2
W = sum(v['w'] + SEP for v in meta.values()); H = max(v['h'] for v in meta.values())
atlas = Image.new('RGBA', (W, H * 2 + SEP), (0, 0, 0, 0))
res = {'alto': H, 'sep': SEP, 'casas': {}}
x = 0
for nom, v in meta.items():
    d = Image.open(os.path.join(src, nom + '_dia.png')).convert('RGBA')
    l = Image.open(os.path.join(src, nom + '_luz.png')).convert('RGBA')
    a = d.split()[3]
    rgb = ImageEnhance.Color(d.convert('RGB')).enhance(0.72)
    rgb = ImageEnhance.Brightness(rgb).enhance(0.9)
    d2 = rgb.convert('RGBA'); d2.putalpha(a)
    atlas.alpha_composite(d2, (x, 0)); atlas.alpha_composite(l, (x, H + SEP))
    # Luces que se ven de frente (alfa en la capa de luz), agrupadas a 10 px.
    la = l.split()[3]; vis = []
    for px, py in v['luces']:
        ok = any(la.getpixel((min(l.width - 1, max(0, int(px) + dx)), min(l.height - 1, max(0, int(py) + dy)))) > 40 for dx in (-1, 0, 1) for dy in (-1, 0, 1))
        if ok and all(abs(px - q[0]) > 10 or abs(py - q[1]) > 10 for q in vis): vis.append([round(px), round(py)])
    res['casas'][nom] = {'x': x, 'w': v['w'], 'h': v['h'], 'suelo': round(v['suelo']), 'luces': vis}
    x += v['w'] + SEP
atlas.save(out + '.webp', 'WEBP', quality=86, method=6, alpha_quality=90)
with open(out + '.json', 'w', encoding='utf-8') as f: json.dump(res, f, separators=(',', ':'))
print('atlas', atlas.size, os.path.getsize(out + '.webp'), 'bytes;', {k: len(v['luces']) for k, v in res['casas'].items()})
