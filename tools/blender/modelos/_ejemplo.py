# Plantilla de GUIA.md, lista para copiar a modelos/<tu familia>.py. No entra en la construccion normal (empieza por _).
# Probarla:  node tools/blender/construir.mjs --foto _ejemplo menhir_a <salida.png>
import numpy as np
from dq_lib import *


@modelo('menhir_a', sustituye={'flora': 'pilar', 'zonas': ['castillo'], 'tam': 5}, tris=(900, 300, 90), lods='decimar')
def menhir_a(lod):                       # lod: 0 alto, 1 medio, 2 bajo. Devuelve UN objeto (o una lista: se unen)
    o = primitiva('cubo', marca='monolito', color='#77736b', lado=1.0)
    mover(o, (0, 0, 2.2), esc=(1.2, 0.8, 5.0))          # origen en el suelo; la base se hunde 0,3 m
    biselar(o, 0.14, 2)                                 # cantos matados: atrapan la luz
    subdividir(o, 2, simple=True)                       # mas malla sin redondear la forma
    deformar(o, lambda P: P * np.c_[1 - 0.3 * np.clip(P[:, 2] / 4.7, 0, 1), 1 - 0.2 * np.clip(P[:, 2] / 4.7, 0, 1), np.ones(len(P))] + np.c_[0.25 * (P[:, 2] / 4.7) ** 2, np.zeros(len(P)), np.zeros(len(P))])   # se afina y se ladea
    desplazar(o, 0.16, 0.7, semilla=3); desplazar(o, 0.04, 3.0, semilla=5)   # forma organica: nada de cajas perfectas
    variar(o, 0.2, 1.2, semilla=4)                      # manchas de luz y sombra horneadas
    manchar(o, '#34421f', lambda P, N: N[:, 2] * 1.2 + np.clip(1.3 - P[:, 2], 0, 1) * 0.8, 0.8)   # musgo arriba y en la base
    desgastar(o, 0.3, 0.25)                             # cantos claros, hendiduras oscuras
    return suavizar(o, 38)                              # sombreado suave salvo cantos de mas de 38 grados
