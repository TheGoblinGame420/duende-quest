# -*- coding: utf-8 -*-
"""
DUENDE QUEST — optimizador de assets.

Los PNG del juego pesaban 91,7 MB en total. Un cofre de 2816x1536 (5,8 MB) se
dibujaba a 38x38 px, y el navegador tenia que reescalar 4,3 megapixeles por
entidad y por frame. Ademas casi todos los sprites tienen enormes margenes
transparentes: como el motor estira la imagen ENTERA dentro de la caja de la
entidad, el personaje sale aplastado al 40-60% de su ancho real.

Este script, para cada asset:
  1. borra la marca de agua del generador de IA (esquina inferior derecha),
     pero solo si ahi hay una manchita aislada y no arte de verdad;
  2. recorta el margen transparente hasta la caja real del dibujo;
  3. reescala a la altura en que se usa de verdad, con margen para pantallas
     retina, usando reduccion por mitades (que conserva el pixel art) mas un
     ultimo paso exacto;
  4. guarda el PNG optimizado y anota la relacion de aspecto real.

Al quedar recortados a su dibujo, el motor puede leer la proporcion correcta
directamente del PNG y dibujarlos sin deformarlos.

Uso:  python tools/optimizar_assets.py [--dry]
Los originales estan en el historial de git si hace falta recuperarlos.
"""
import os
import sys

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRY = '--dry' in sys.argv

# Altura de destino por asset. Es la altura logica a la que lo dibuja el motor,
# multiplicada por ~3 para que aguante pantallas de alta densidad sin verse
# blando. Mas alla de eso solo se gastan megabytes.
OBJETIVOS = {
    'skins/skin_hero.png': 210,
    'skins/skin_berserker.png': 210,
    'skins/skin_king.png': 210,
    'skins/skin_tactico.png': 210,
    'skins/skin_necromancer.png': 210,
    'skins/skin_legendariafull.png': 210,
    'skins/duende_comun.png': 210,
    'enemigos/enemy.png': 200,
    'enemigos/enemy2.png': 280,
    'enemigos/enemy_magmar.png': 240,
    'items/item_potion.png': 96,
    'items/item_shield.png': 96,
    'items/item_skill.png': 96,
    'items/skill_fire.png': 128,
    'cofres/cofre_comun.png': 120,
    'cofres/cofre_epico.png': 120,
    'cofres/cofrelegendario.png': 120,
    'armas/katana_comun_item.png': 96,
    'armas/katana_spark_item.png': 96,
    'ui/coin.png': 96,
}


def quitar_marca(img):
    """Borra la marca de agua de la esquina inferior derecha.

    Solo actua si en esa esquina hay muy poco contenido: si estuviera el propio
    dibujo, la ocupacion seria alta y no queremos comernos arte real.
    """
    w, h = img.size
    cw, ch = int(w * 0.09), int(h * 0.09)
    caja = (w - cw, h - ch, w, h)
    esquina = img.crop(caja)
    alpha = esquina.getchannel('A')
    opacos = sum(1 for p in alpha.getdata() if p > 24)
    ocupacion = opacos / float(cw * ch)
    if 0 < ocupacion < 0.30:
        img.paste((0, 0, 0, 0), caja)
        return True
    return False


def reducir(img, alto_objetivo):
    """Reduce a la altura pedida por mitades sucesivas.

    Saltar de 2816 px a 120 de golpe destroza el pixel art; ir dividiendo por
    dos conserva la estructura y el ultimo paso ajusta la medida exacta.
    """
    while img.height > alto_objetivo * 2:
        img = img.resize((max(1, img.width // 2), max(1, img.height // 2)), Image.BOX)
    if img.height != alto_objetivo:
        ancho = max(1, int(round(img.width * alto_objetivo / float(img.height))))
        img = img.resize((ancho, alto_objetivo), Image.LANCZOS)
    return img


def procesar():
    meta = {}
    antes_total = despues_total = 0
    for rel, alto in sorted(OBJETIVOS.items()):
        ruta = os.path.join(RAIZ, 'assets', rel.replace('/', os.sep))
        if not os.path.exists(ruta):
            print('  FALTA %s' % rel)
            continue
        antes = os.path.getsize(ruta)
        img = Image.open(ruta).convert('RGBA')
        w0, h0 = img.size

        marca = quitar_marca(img)
        caja = img.getbbox()
        if caja:
            img = img.crop(caja)
        recorte = img.size
        img = reducir(img, alto)

        clave = os.path.splitext(os.path.basename(rel))[0]
        meta[clave] = round(img.width / float(img.height), 4)

        if not DRY:
            img.save(ruta, 'PNG', optimize=True)
        despues = os.path.getsize(ruta) if not DRY else antes
        antes_total += antes
        despues_total += despues
        print('  %-34s %sx%s -> recorte %sx%s -> %sx%s  %6.2fMB -> %5.1fKB%s'
              % (rel, w0, h0, recorte[0], recorte[1], img.width, img.height,
                 antes / 1048576.0, despues / 1024.0, '  [marca borrada]' if marca else ''))

    # No hace falta volcar las proporciones a un fichero: como los PNG quedan
    # recortados a su dibujo, el motor lee la proporcion buena directamente de
    # naturalWidth/naturalHeight.
    print('\n  TOTAL: %.1f MB -> %.2f MB' % (antes_total / 1048576.0, despues_total / 1048576.0))
    return meta


if __name__ == '__main__':
    print('Optimizando assets%s...\n' % (' (simulacion)' if DRY else ''))
    procesar()
