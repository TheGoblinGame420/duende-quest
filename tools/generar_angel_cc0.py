# -*- coding: utf-8 -*-
"""
DUENDE QUEST — hoja de animacion del ANGEL, jefe final de la campaña.

Hasta ahora el unico jefe del juego es 'oso' (JEFES en js/engine.js): un
oso reciclado por bioma via tinte de color, con nombre y repertorio de
ataques distintos (NOMBRES_JEFE / ESTILO_JEFE) pero SIEMPRE el mismo
sprite estatico (assets/enemigos/enemy2.png). Este es el primer jefe con
silueta propia: un angel (GothicVania Church, ansimuz, CC0 — ver
recursos/mapas/ansimuz-gothicvania-church/SPRITES/angel), pensado para
reemplazar al oso SOLO en la ultima etapa de la campaña (5-3), como
cierre real de las 15 etapas en vez de "otro oso mas".

Dibuja con el sistema de hoja ya existente (SHEETS/sheetFrame/drawSheet
en engine.js) sin cambios de motor: el codigo del jefe (actualizarJefe,
_jefeElegirAtaque, el telegrafiado por estado en animEnemigo) ya es
generico y no depende del sprite, solo dibuja lo que sea que tenga
e.sheet — asi que basta con darle uno.

El pack trae 8 frames "idle" (aleteo, alturas de bounding box muy
distintas: desde alas replegadas hasta alas bien abiertas) y 3 de
"angel-attack" (casi identicos al idle a simple vista, se usan como
flash de golpe). No trae frames de daño ni muerte propios: nMuerte=1
reusa el ultimo frame de "attack" como pose de colapso, mismo patron ya
probado con lagarto/serpiente — el fade por alpha que animEnemigo() ya
aplica a todo enemigo con e.sheet durante e.muriendo hace el resto.

La celda (122x117) es mucho mas grande que las de goblin/esqueleto
(32x64): eso no importa para drawSheet(), que siempre escala la celda
COMPLETA por el mismo factor (altoObjetivo/idealAltoPx) sin recortar —
el tamaño en pantalla no varia frame a frame aunque el contenido dibujado
dentro de la celda si varie mucho (alas abiertas vs plegadas).

Uso:  python tools/generar_angel_cc0.py
"""
import os

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN = os.path.join(RAIZ, 'recursos', 'mapas', 'ansimuz-gothicvania-church', 'SPRITES', 'angel', 'sprites')
DESTINO = os.path.join(RAIZ, 'assets', 'enemigos', 'sheets')

CELDA = 122, 117
N_IDLE = 8
N_ATTACK = 3


def main():
    os.makedirs(DESTINO, exist_ok=True)
    idle = [Image.open(os.path.join(ORIGEN, 'idle', f'angel{i}.png')).convert('RGBA') for i in range(1, N_IDLE + 1)]
    ataque = [Image.open(os.path.join(ORIGEN, 'angel-attack', f'angel-attack-{i}.png')).convert('RGBA') for i in range(1, N_ATTACK + 1)]
    for im in idle + ataque:
        assert im.size == CELDA, im.size

    ancho = CELDA[0] * max(N_IDLE, N_ATTACK)
    hoja = Image.new('RGBA', (ancho, CELDA[1] * 2), (0, 0, 0, 0))
    for i, im in enumerate(idle):
        hoja.paste(im, (i * CELDA[0], 0))
    for i, im in enumerate(ataque):
        hoja.paste(im, (i * CELDA[0], CELDA[1]))

    hoja = hoja.quantize(colors=48, method=Image.Quantize.FASTOCTREE)
    ruta = os.path.join(DESTINO, 'angel.png')
    hoja.save(ruta, optimize=True)
    print(f'angel.png {hoja.size} -> {os.path.getsize(ruta)} bytes')


if __name__ == '__main__':
    main()
