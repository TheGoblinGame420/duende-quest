# Recorta el fondo oscuro de las 10 mascotas: alfa suave en el halo, cuerpo opaco.
import sys, os, numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
src, out = sys.argv[1], sys.argv[2]
MAPA = {8:'sapo_rey', 9:'zorro_mistico', 10:'buho_runas', 11:'dragon_jade', 12:'gato_duende', 13:'hongo_brillante', 14:'lobo_sombrio', 15:'fenix_esmeralda', 16:'golem_cristal', 17:'escarabajo_aureo'}
T1 = {'gato_duende': 26, 'lobo_sombrio': 30, 'buho_runas': 27, 'zorro_mistico': 28}
solo = sys.argv[3].split(',') if len(sys.argv) > 3 else None
hoja = []
for n, nom in MAPA.items():
    if solo and nom not in solo: continue
    im = np.asarray(Image.open(os.path.join(src, f'{n}.jpg')).convert('RGB')).astype(np.float32)
    im = cv2.resize(im, (1000, 1000), interpolation=cv2.INTER_AREA)
    H, W, _ = im.shape
    # Fondo: mediana del borde y luego campo suave (viñeta) con los pixeles parecidos.
    borde = np.concatenate([im[:30].reshape(-1,3), im[-30:].reshape(-1,3), im[:, :30].reshape(-1,3), im[:, -30:].reshape(-1,3)])
    bg = np.median(borde, axis=0)[None, None, :] * np.ones_like(im)
    for _ in range(3):
        d = np.linalg.norm(im - bg, axis=2)
        m = (d < 22).astype(np.float32)
        num = cv2.GaussianBlur(im * m[..., None], (0, 0), 60)
        den = cv2.GaussianBlur(m, (0, 0), 60)[..., None]
        bg = np.where(den > 0.02, num / np.maximum(den, 1e-4), bg)
    d = np.linalg.norm(im - bg, axis=2)
    d = cv2.GaussianBlur(d, (0, 0), 1.2)
    t1 = T1.get(nom, 48)
    bajo = d < t1
    et, _n = ndi.label(bajo)
    toca = np.unique(np.concatenate([et[0], et[-1], et[:, 0], et[:, -1]]))
    fuera = np.isin(et, toca[toca > 0])
    # Cuerpo = lo que no es fuera; se cierran agujeritos y se quitan motas sueltas lejos del cuerpo.
    cuerpo = ~fuera
    # Huecos de fondo puro encerrados (entre el ala y el cuerpo): tambien son fondo.
    for i in range(1, _n + 1):
        if i in toca: continue
        comp = et == i
        if comp.sum() > 250 and d[comp].mean() < 9: cuerpo &= ~comp
    et2, n2 = ndi.label(cuerpo)
    if n2 > 1:
        tam = ndi.sum(cuerpo, et2, range(1, n2 + 1))
        grande = 1 + int(np.argmax(tam))
        cuerpo = np.isin(et2, [i + 1 for i, t in enumerate(tam) if t >= 40])   # chispas: se quedan si no son ruido
    alfa_halo = np.clip(d / t1, 0, 1) ** 1.35
    alfa_halo[d < 5] = 0
    alfa = np.where(cuerpo, 1.0, alfa_halo).astype(np.float32)
    alfa = cv2.GaussianBlur(alfa, (0, 0), 0.8)
    # Color sin el fondo mezclado (para que el halo no deje un cerco oscuro sobre cielo claro).
    a3 = np.maximum(alfa, 0.04)[..., None]
    col = np.clip(bg + (im - bg) / a3, 0, 255)
    col = np.where(alfa[..., None] > 0.985, im, col)
    rgba = np.dstack([col, alfa * 255]).astype(np.uint8)
    # Recorte al contenido (alfa > 8 %) con margen, lienzo cuadrado.
    ys, xs = np.where(alfa > 0.08)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    lado = int(max(y1 - y0, x1 - x0) * 1.06) + 2
    cy, cx = (y0 + y1) // 2, (x0 + x1) // 2
    lienzo = np.zeros((lado, lado, 4), np.uint8)
    sy0, sx0 = cy - lado // 2, cx - lado // 2
    ya, yb, xa, xb = max(0, sy0), min(H, sy0 + lado), max(0, sx0), min(W, sx0 + lado)
    lienzo[ya - sy0:yb - sy0, xa - sx0:xb - sx0] = rgba[ya:yb, xa:xb]
    pil = Image.fromarray(lienzo, 'RGBA')
    pil.resize((256, 256), Image.LANCZOS).save(os.path.join(out, nom + '.webp'), quality=88, method=6)
    pil.resize((96, 96), Image.LANCZOS).save(os.path.join(out, nom + '_s.webp'), quality=86, method=6)
    hoja.append((nom, pil.resize((300, 300), Image.LANCZOS)))
    print(nom, 't1', t1, 'bbox', x0, y0, x1, y1, 'cuerpo %', round(100 * cuerpo.mean(), 1))
# Hoja de contacto: sobre cielo claro, sobre pasto y sobre panel oscuro.
if hoja:
    fondos = [(124, 196, 240), (96, 160, 84), (13, 22, 20)]
    hc = Image.new('RGB', (300 * len(hoja), 300 * len(fondos)))
    for i, (nom, p) in enumerate(hoja):
        for j, f in enumerate(fondos):
            b = Image.new('RGB', (300, 300), f); b.paste(p, (0, 0), p); hc.paste(b, (300 * i, 300 * j))
    hc.save(os.path.join(out, '_hoja.png'))
