# ═══════════════════════════════════════════════════════
# QR de la etiqueta de la botella y arte de /chicha/. Sin dependencias de QR:
# generador propio (ISO/IEC 18004, modo byte, versiones 1 a 6) y un lector que
# lee de vuelta el PNG y el SVG y comprueba Reed-Solomon antes de dar por bueno.
#
#   python tools/etiqueta_qr.py
#
# Salida en assets/etiqueta/ (qr-chicha.png, qr-chicha.svg, escena.jpg) y
# assets/og/chicha.jpg. El arte necesita Pillow y las fuentes de Windows.
# ═══════════════════════════════════════════════════════
import os, re, sys

URL = 'https://duende-quest.alfonso12hc.workers.dev/chicha/?utm_source=etiqueta'
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'assets', 'etiqueta')
BORDE = 4       # zona blanca obligatoria, en modulos
MODULO_PX = 40  # PNG de 1960 px con la version 6

# nivel: (bits de formato, {version: (ecc por bloque, bloques, datos por bloque corto)})
# Un .5 significa mitad de bloques con ese largo y mitad con uno mas (5-Q y 5-H).
TABLA = {
    'L': (1, {1: (7, 1, 19), 2: (10, 1, 34), 3: (15, 1, 55), 4: (20, 1, 80), 5: (26, 1, 108), 6: (18, 2, 68)}),
    'M': (0, {1: (10, 1, 16), 2: (16, 1, 28), 3: (26, 1, 44), 4: (18, 2, 32), 5: (24, 2, 43), 6: (16, 4, 27)}),
    'Q': (3, {1: (13, 1, 13), 2: (22, 1, 22), 3: (18, 2, 17), 4: (26, 2, 24), 5: (18, 4, 15.5), 6: (24, 4, 19)}),
    'H': (2, {1: (17, 1, 9), 2: (28, 1, 16), 3: (22, 2, 13), 4: (16, 4, 9), 5: (22, 4, 11.5), 6: (28, 4, 15)}),
}
RESTO = {1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7}
ALINEA = {1: None, 2: 18, 3: 22, 4: 26, 5: 30, 6: 34}

EXP, LOG = [0] * 512, [0] * 256
_x = 1
for _i in range(255):
    EXP[_i] = _x
    LOG[_x] = _i
    _x <<= 1
    if _x & 0x100:
        _x ^= 0x11D
for _i in range(255, 512):
    EXP[_i] = EXP[_i - 255]


def gmul(a, b):
    return EXP[LOG[a] + LOG[b]] if a and b else 0


def rs(datos, n):
    gen = [1]
    for i in range(n):
        nuevo = [0] * (len(gen) + 1)
        for j, c in enumerate(gen):
            nuevo[j] ^= c
            nuevo[j + 1] ^= gmul(c, EXP[i])
        gen = nuevo
    r = [0] * n
    for b in datos:
        f = b ^ r[0]
        r = r[1:] + [0]
        for j in range(n):
            r[j] ^= gmul(gen[j + 1], f)
    return r


def bloques(version, nivel):
    ecc, nb, corto = TABLA[nivel][1][version]
    if corto != int(corto):
        return ecc, [int(corto)] * (nb // 2) + [int(corto) + 1] * (nb - nb // 2)
    return ecc, [int(corto)] * nb


def codewords(texto, version, nivel):
    ecc, largos = bloques(version, nivel)
    cap = sum(largos)
    d = texto.encode('utf-8')
    bits = [0, 1, 0, 0] + [(len(d) >> i) & 1 for i in range(7, -1, -1)]
    for b in d:
        bits += [(b >> i) & 1 for i in range(7, -1, -1)]
    if len(bits) > cap * 8:
        return None
    bits += [0] * min(4, cap * 8 - len(bits))
    bits += [0] * (-len(bits) % 8)
    cw = [int(''.join(map(str, bits[i:i + 8])), 2) for i in range(0, len(bits), 8)]
    relleno = 0xEC
    while len(cw) < cap:
        cw.append(relleno)
        relleno ^= 0xEC ^ 0x11
    grupos, eccs, p = [], [], 0
    for n in largos:
        grupos.append(cw[p:p + n])
        eccs.append(rs(cw[p:p + n], ecc))
        p += n
    salida = [g[i] for i in range(max(largos)) for g in grupos if i < len(g)]
    salida += [e[i] for i in range(ecc) for e in eccs]
    return salida


def formato(nivel, mascara):
    d = (TABLA[nivel][0] << 3) | mascara
    r = d
    for _ in range(10):
        r = (r << 1) ^ ((r >> 9) * 0x537)
    return ((d << 10) | (r & 0x3FF)) ^ 0x5412


def es_mascara(m, y, x):
    return [(x + y) % 2 == 0, y % 2 == 0, x % 3 == 0, (x + y) % 3 == 0, (x // 3 + y // 2) % 2 == 0,
            x * y % 2 + x * y % 3 == 0, (x * y % 2 + x * y % 3) % 2 == 0, ((x + y) % 2 + x * y % 3) % 2 == 0][m]


def funcionales(version):
    n = 17 + 4 * version
    M = [[0] * n for _ in range(n)]
    F = [[False] * n for _ in range(n)]

    def pon(x, y, v):
        M[y][x] = int(v)
        F[y][x] = True

    for cx, cy in ((3, 3), (n - 4, 3), (3, n - 4)):
        for dy in range(-4, 5):
            for dx in range(-4, 5):
                x, y = cx + dx, cy + dy
                if 0 <= x < n and 0 <= y < n:
                    d = max(abs(dx), abs(dy))
                    pon(x, y, d != 2 and d != 4)
    if ALINEA[version]:
        c = ALINEA[version]
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                pon(c + dx, c + dy, max(abs(dx), abs(dy)) != 1)
    for i in range(8, n - 8):
        pon(i, 6, i % 2 == 0)
        pon(6, i, i % 2 == 0)
    # Reserva del formato (se escribe al elegir mascara) y modulo oscuro.
    for i in range(9):
        F[8][i] = F[i][8] = True
    for i in range(8):
        F[8][n - 1 - i] = F[n - 1 - i][8] = True
    pon(8, n - 8, 1)
    return M, F


def recorrido(n):
    # Columnas de dos en dos, de derecha a izquierda, saltando la del temporizador.
    der = n - 1
    while der >= 1:
        if der == 6:
            der = 5
        arriba = ((der + 1) & 2) == 0
        for v in range(n):
            for j in range(2):
                yield (n - 1 - v if arriba else v), der - j
        der -= 2


def pon_formato(M, nivel, mascara):
    n, f = len(M), formato(nivel, mascara)
    b = lambda i: (f >> i) & 1
    for i in range(6):
        M[i][8] = b(i)
    M[7][8] = b(6)
    M[8][8] = b(7)
    M[8][7] = b(8)
    for i in range(9, 15):
        M[8][14 - i] = b(i)
    for i in range(8):
        M[8][n - 1 - i] = b(i)
    for i in range(8, 15):
        M[n - 15 + i][8] = b(i)


def penalidad(M):
    n, p = len(M), 0
    A = (1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0)
    filas = [list(f) for f in M] + [[M[y][x] for y in range(n)] for x in range(n)]
    for f in filas:
        run, prev = 0, None
        for v in f:
            if v == prev:
                run += 1
                if run == 5:
                    p += 3
                elif run > 5:
                    p += 1
            else:
                run, prev = 1, v
        for i in range(n - 10):
            t = tuple(f[i:i + 11])
            if t == A or t == A[::-1]:
                p += 40
    for y in range(n - 1):
        for x in range(n - 1):
            if M[y][x] == M[y][x + 1] == M[y + 1][x] == M[y + 1][x + 1]:
                p += 3
    negros = sum(map(sum, M))
    p += abs(negros * 20 - n * n * 10) // (n * n) * 10
    return p


def generar(texto, nivel='Q'):
    for version in range(1, 7):
        cw = codewords(texto, version, nivel)
        if cw is not None:
            break
    else:
        raise ValueError('El texto no cabe en la version 6-' + nivel)
    bits = [(c >> i) & 1 for c in cw for i in range(7, -1, -1)] + [0] * RESTO[version]
    base, F = funcionales(version)
    n = len(base)
    celdas = [(y, x) for y, x in recorrido(n) if not F[y][x]]
    assert len(celdas) == len(bits), (len(celdas), len(bits))
    mejor = None
    for m in range(8):
        M = [f[:] for f in base]
        for (y, x), b in zip(celdas, bits):
            M[y][x] = b ^ int(es_mascara(m, y, x))
        pon_formato(M, nivel, m)
        s = penalidad(M)
        if mejor is None or s < mejor[0]:
            mejor = (s, m, M)
    return version, mejor[1], mejor[2]


# ── Lector: parte de los pixeles, no de lo que sabe el generador ──
def leer_formato(M):
    n = len(M)
    a = sum(M[i][8] << i for i in range(6)) | (M[7][8] << 6) | (M[8][8] << 7) | (M[8][7] << 8)
    for i in range(9, 15):
        a |= M[8][14 - i] << i
    b = sum(M[8][n - 1 - i] << i for i in range(8))
    for i in range(8, 15):
        b |= M[n - 15 + i][8] << i
    assert a == b, 'las dos copias del formato no coinciden'
    for nivel in TABLA:
        for m in range(8):
            if formato(nivel, m) == a:
                return nivel, m
    raise ValueError('formato invalido')


def decodificar(M):
    n = len(M)
    version = (n - 17) // 4
    nivel, m = leer_formato(M)
    _, F = funcionales(version)
    bits = [M[y][x] ^ int(es_mascara(m, y, x)) for y, x in recorrido(n) if not F[y][x]]
    cw = [int(''.join(map(str, bits[i:i + 8])), 2) for i in range(0, len(bits) - len(bits) % 8, 8)]
    ecc, largos = bloques(version, nivel)
    datos, p = [[] for _ in largos], 0
    for i in range(max(largos)):
        for j, L in enumerate(largos):
            if i < L:
                datos[j].append(cw[p])
                p += 1
    resto = [[] for _ in largos]
    for _ in range(ecc):
        for j in range(len(largos)):
            resto[j].append(cw[p])
            p += 1
    for d, e in zip(datos, resto):
        pal = d + e
        for i in range(ecc):
            s = 0
            for c in pal:
                s = gmul(s, EXP[i]) ^ c
            assert s == 0, 'Reed-Solomon no cuadra'
    todo = [c for d in datos for c in d]
    flujo = ''.join(format(c, '08b') for c in todo)
    assert flujo[:4] == '0100', 'no es modo byte'
    largo = int(flujo[4:12], 2)
    return bytes(int(flujo[12 + 8 * i:20 + 8 * i], 2) for i in range(largo)).decode('utf-8'), version, nivel, m


def matriz_png(ruta):
    from PIL import Image
    im = Image.open(ruta).convert('L')
    w, h = im.size
    assert w == h
    px = im.load()
    # Primer pixel oscuro de la diagonal = esquina del buscador; su corrida de 7 modulos da el tamano.
    i = 0
    while px[i, i] > 128:
        i += 1
    j = i
    while px[j, i] < 128:
        j += 1
    mod = (j - i) / 7
    n = round((w - 2 * i) / mod)
    return [[int(px[int(i + (x + .5) * mod), int(i + (y + .5) * mod)] < 128) for x in range(n)] for y in range(n)]


def matriz_svg(ruta):
    t = open(ruta, encoding='utf-8').read()
    lado = int(re.search(r'viewBox="0 0 (\d+) \1"', t).group(1))
    n = lado - 2 * BORDE
    M = [[0] * n for _ in range(n)]
    for x, y, w in re.findall(r'M(\d+) (\d+)h(\d+)v1h-\3z', t):
        for k in range(int(w)):
            M[int(y) - BORDE][int(x) + k - BORDE] = 1
    return M


def escribir_svg(M, ruta):
    n = len(M)
    d = []
    for y in range(n):
        x = 0
        while x < n:
            if M[y][x]:
                k = x
                while k < n and M[y][k]:
                    k += 1
                d.append('M%d %dh%dv1h-%dz' % (x + BORDE, y + BORDE, k - x, k - x))
                x = k
            else:
                x += 1
    lado = n + 2 * BORDE
    s = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" shape-rendering="crispEdges">'
         '<title>QR de Duende Quest: %s</title><path fill="#fff" d="M0 0h%dv%dH0z"/><path fill="#000" d="%s"/></svg>\n'
         % (lado, lado, URL, lado, lado, ''.join(d)))
    with open(ruta, 'w', encoding='utf-8', newline='\n') as f:
        f.write(s)


def escribir_png(M, ruta):
    from PIL import Image
    n, b = len(M), BORDE
    pix = Image.new('1', (n + 2 * b,) * 2, 1)
    for y in range(n):
        for x in range(n):
            if M[y][x]:
                pix.putpixel((x + b, y + b), 0)
    pix.resize(((n + 2 * b) * MODULO_PX,) * 2, Image.NEAREST).save(ruta, optimize=True, dpi=(1200, 1200))


def pruebas():
    # Vectores publicados: Reed-Solomon de «HELLO WORLD» 1-M y formatos de la norma.
    d = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17]
    assert rs(d, 10) == [196, 35, 39, 119, 235, 215, 231, 226, 93, 23], 'RS no coincide con el vector'
    assert formato('L', 0) == 0b111011111000100 and formato('Q', 0) == 0b011010101011111, 'formato'
    assert formato('M', 5) == 0b100000011001110 and formato('H', 7) == 0b000100000111011, 'formato'
    # Ida y vuelta con todos los tamanos y niveles (tambien por la rama de bloques desiguales).
    for txt in ('a', 'b' * 20, 'c' * 30, 'd' * 40, 'e' * 46, 'f' * 60):
        for nivel in 'LMQH':
            try:
                v, m, M = generar(txt, nivel)
            except ValueError:
                continue
            r = decodificar(M)
            assert r[0] == txt and r[2] == nivel and r[3] == m, (txt, nivel, r)


def arte():
    from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
    f = Image.open(os.path.join(RAIZ, 'assets', 'promo', 'historia_3.jpg')).convert('RGB')
    escena = f.crop((0, 642, 1080, 1320))  # el combate entero (casco y pies), sin los textos del afiche
    e = escena.resize((720, 452), Image.LANCZOS)
    e.save(os.path.join(SALIDA, 'escena.jpg'), quality=72, optimize=True, progressive=True)

    W, H = 1200, 630
    ff = 'C:/Windows/Fonts/'
    fondo = escena.resize((W, H), Image.LANCZOS)
    fondo = ImageEnhance.Brightness(fondo.filter(ImageFilter.GaussianBlur(16))).enhance(.42)
    og = Image.blend(fondo, Image.new('RGB', (W, H), (46, 16, 92)), .55)
    d = ImageDraw.Draw(og)
    t1 = ImageFont.truetype(ff + 'impact.ttf', 80)
    t2 = ImageFont.truetype(ff + 'segoeuib.ttf', 30)
    y = 66
    for lin in ('ESTA BOTELLA', 'VIENE DEL', 'CÁNTARO ETERNO'):
        d.text((60, y), lin, font=t1, fill=(255, 216, 74), stroke_width=5, stroke_fill=(16, 6, 34))
        y += 100
    d.text((60, 384), 'Su chicha encendía el sol del bosque.', font=t2, fill=(255, 255, 255))
    d.text((60, 428), 'Alguien abrió la puerta. Descubre quién.', font=t2, fill=(255, 255, 255))
    d.rounded_rectangle((60, 500, 500, 562), 31, fill=(255, 216, 74))
    d.text((280, 531), 'Juega gratis en tu celular', font=ImageFont.truetype(ff + 'segoeuib.ttf', 28), fill=(26, 10, 46), anchor='mm')
    # Captura del juego, enmarcada a la derecha.
    fw, fh = 470, 287
    cap = escena.resize((fw, fh), Image.LANCZOS)
    mar = Image.new('RGB', (fw + 12, fh + 12), (255, 216, 74))
    mar.paste(cap, (6, 6))
    mas = Image.new('L', mar.size, 0)
    ImageDraw.Draw(mas).rounded_rectangle((0, 0, mar.size[0] - 1, mar.size[1] - 1), 22, fill=255)
    og.paste(mar, (W - fw - 50, 165), mas)
    og.save(os.path.join(RAIZ, 'assets', 'og', 'chicha.jpg'), quality=82, optimize=True, progressive=True)


def main():
    pruebas()
    os.makedirs(SALIDA, exist_ok=True)
    version, mascara, M = generar(URL, 'Q')
    png, svg = os.path.join(SALIDA, 'qr-chicha.png'), os.path.join(SALIDA, 'qr-chicha.svg')
    escribir_png(M, png)
    escribir_svg(M, svg)
    for nombre, leida in (('PNG', matriz_png(png)), ('SVG', matriz_svg(svg))):
        texto, v, nivel, m = decodificar(leida)
        assert texto == URL and leida == M, nombre + ' no se lee igual'
        print('OK  %s se lee: %s (version %d-%s, mascara %d)' % (nombre, texto, v, nivel, m))
    arte()
    print('OK  arte en assets/etiqueta/escena.jpg y assets/og/chicha.jpg')


if __name__ == '__main__':
    sys.exit(main())
