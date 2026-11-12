# Guía de modelado: Blender → Duende Quest ORIGINS

Cadena: `tools/blender/modelos/<familia>.py` → Blender 5.3 sin ventana → `assets/3d/dq_<familia>.json + .bin + .bin.gz` → `mundo/js/modelado.js` (`PAQ`) → el mundo. Ejemplo completo y probado: `modelos/arboles.py`.

## Comandos
```
node tools/blender/construir.mjs <familia>                     # construye TU paquete y rehace dq_indice.json
node tools/blender/construir.mjs --foto <familia> <modelo|a,b|todos> <salida.png> [--tinte=#3f7a45 --giro=40 --elev=20 --noche --lod=0 --rapido]
node tools/blender/construir.mjs --indice                      # solo el índice (tras fusionar ramas)
```
La foto de UN modelo saca sus 3 niveles (alto, medio, bajo); con varios o `todos`, el nivel alto de cada uno. Mírala con Read antes de abrir el juego. La construcción FALLA si un nivel pasa su límite de triángulos en más de un 10 %.

## Plantilla de un modelo
```python
from dq_lib import *

@modelo('menhir_a', sustituye={'flora': 'pilar', 'zonas': ['castillo'], 'tam': 5}, tris=(900, 300, 90), lods='decimar')
def menhir_a(lod):                       # lod: 0 alto, 1 medio, 2 bajo. Devuelve UN objeto (o una lista: se unen)
    o = primitiva('cubo', marca='monolito', color='#77736b', lado=1.0)
    mover(o, (0, 0, 2.2), esc=(1.2, 0.8, 5.0))          # origen en el suelo; la base se hunde 0,3 m
    biselar(o, 0.14, 2)                                 # cantos matados: atrapan la luz
    subdividir(o, 2, simple=True)                       # más malla sin redondear la forma
    desplazar(o, 0.16, 0.7, semilla=3); desplazar(o, 0.04, 3.0, semilla=5)   # forma orgánica: nada de cajas perfectas
    variar(o, 0.2, 1.2, semilla=4)                      # manchas de luz y sombra horneadas
    manchar(o, '#34421f', lambda P, N: N[:, 2] * 1.2 + np.clip(1.3 - P[:, 2], 0, 1) * 0.8, 0.8)   # musgo arriba y en la base
    desgastar(o, 0.3, 0.25)                             # cantos claros, hendiduras oscuras
    return suavizar(o, 38)                              # sombreado suave salvo cantos de más de 38°
```
- Esta plantilla, completa y probada, está en `modelos/_ejemplo.py` (los archivos que empiezan por `_` no entran en la construcción normal).
- `lods='propio'` (por defecto): tu función se llama 3 veces y decide cuánta malla pone en cada nivel (usa la MISMA semilla: que no cambie la silueta). `lods='decimar'`: solo se llama con 0 y los tres niveles se ajustan solos a su límite reduciendo.
- Al terminar, la biblioteca triangula, hornea la oclusión ambiental en el color (`ao=0.75`, `ao_dist=1.6`, `suelo=True`), comprueba triángulos y exporta. No lo hagas tú.

## Biblioteca (`dq_lib.py`; lee las docstrings)
- Crear: `malla(nombre, verts, caras, marca, color)`, `primitiva('cubo'|'esfera'|'cilindro'|'cono', ...)`, `tubo(puntos, radios, lados, perfil=)` (troncos, vigas, cuerdas), `curva(puntos, n)`, `masa(bolas, voxel, tris)` (volúmenes fundidos: follaje, montones, rocas), `esfera(...)`, `hojas_sueltas(base, n, tam)`.
- Forma: `mover`, `subdividir`, `biselar`, `desplazar` (ruido), `deformar(o, fn)`, `remallar`, `decimar(o, tris)`, `suavizar(o, ángulo)`, `unir([...])`, `copiar`, `dos_caras(o)` (láminas: telas, hojas).
- Color (por vértice, lineal): `pintar`, `pintar_fn(o, fn(P, N, C))`, `degradar`, `variar`, `manchar`, `desgastar`. Utilidades: `pos`, `normales`, `ruido`, `ruido_fbm`, `azar(semilla)`, `hexlin('#rrggbb')`.
- Marcas y viento: `marcar(o, 'piedra', donde=)`, `poner_viento(o, 0..1 | fn(P))`, `inflar(o, centros, peso)` (normales redondeadas para follaje).
- Puedes usar cualquier cosa de `bpy`/`bmesh` (modificadores, nodos de geometría) si al final devuelves una malla con el color en el atributo de punto `col`.

## Convenciones
- Metros reales. Z arriba, frente hacia −Y, **origen en el suelo y en el centro de la pieza**. Lo que toca el suelo baja hasta z ≈ −0,3 (−0,7 si va en laderas) para que no flote.
- Paleta «medieval místico»: desaturada y oscura. Piedra `#6f6b64`–`#8f8a80`, madera `#3f3226`–`#5c4a38`, musgo `#34421f`, teja `#7a3a22`, hierro `#3a3a40`; acentos solo en emisivos (ámbar `#ffb45a`, verde `#3fd6b4`, violeta `#8a5cf0`).
- **Marcas** (ranura de material de cada cara; es lo que el juego llama `tinte`): `liso` 0 (su color tal cual) · `hoja` 1 (toma el color de la zona y se mece: el color pintado es un MULTIPLICADOR, (1,1,1) = el verde de la zona) · `teja` 2 · `piedra` 3 (sillares; el musgo de la zona cubre lo que mira arriba) · `madera` 4 · `vidrio` 5 (vidriera: luz cálida de noche) · `puerta` 6 · `emisivo` 7 (brilla) · `monolito` 8 (piedra de una pieza). Instanciado (material orgánico de `modelado.js`) solo cambian el dibujo 1, 3, 7 y 8; fundido en la obra (`KIT.fundir` + `KIT.material`) valen todas con su textura procedural (`arquitectura.js`).
- Sin texturas ni UV: todo el color va por vértice. El detalle fino (veta, manchas de hoja) lo pone el material en el juego.
- Diseños originales. Nada copiado de otros juegos ni descargado.

## Presupuestos
- Por modelo: `tris=(1500, 500, 150)` por defecto. Baja el tuyo si la pieza se repite mucho (arbusto 700/250/70) o es pequeña. Súbelo solo para piezas únicas (un edificio fundido una vez puede llegar a 4 000 en alto).
- Por familia: ≤ ~400 KB el `.bin.gz` (árboles: 18 modelos, 190 KB). Cuesta ~8 bytes por triángulo comprimido.
- En el juego, calidad media: `tools/bench3d.mjs` no debe subir más de ~0,8 ms de total p50 ni ~10 % de dibujos. Mide antes y después (también con `?sinModelado`, que deja el mundo como estaba).

## Declarar qué sustituye (`sustituye={...}`), sin tocar JavaScript
- **Flora y decorado sembrado** (árboles, rocas, pilares, hongos…): `{'flora': tipo, 'zonas': [...], 'tam': metros, 'modo': 'a', 'orilla': True, 'lejos': 'otro_modelo'}`. `tipo` es uno de `FLORA`/`VAR_K` en `mundo.js`: `pino nieve redondo arbusto muerto cactus pilar palma roca flor hongo hierba tocon cristal magico`. Sin `zonas` vale para todas. `tam`: alto en metros (o ancho con `'modo': 'a'`); sin él, el modelo va a su tamaño real. `lejos`: de lejos se dibuja con la malla de ese otro modelo (variantes b, c → la a: un dibujo menos por celda). Varios modelos con el mismo tipo y zona = variantes al azar. El juego conserva posición, giro, escala y **colisión** (`SOLIDO`, `TAPAN`): respeta el grosor y el alto del original.
- **Pieza del kit** (`KIT.geo('p_wall')` y compañía): `{'kit': 'p_wall'}`. Misma caja y unidades que la pieza (mira `min`/`max` en `assets/3d/kenney.json`); se dibuja con el material de obra (sombreado plano + textura por marca).
- **Colocado por código**: a `crearObra` (`arquitectura.js`) le llegan `PAQ` y `propios`. `PAQ.geo(nombre, lod)` da la geometría (sirve en `KIT.fundir([{ geo, x, y, z, ry, s, t }])`), `PAQ.material` es el material instanciable y `propios(nombre, [{ x, y, z, rot, s, color, zona }])` siembra copias con los 3 niveles de detalle y el recorte por distancia ya resueltos. Comprueba siempre `if (PAQ && PAQ.modelos[nombre])` y deja lo de antes en el `else` (respaldo).

## Probar en el juego
1. `PUERTO=<tu puerto> DATOS="<tu carpeta>/datos.json" node tools/mmo_local.mjs` y `http://localhost:<puerto>/mundo/?hora=13&clima=despejado` con `tools/cdp.mjs` (teletransporte: `s.p.x/z` por `/__dev` + `__dq3.recibir({t:'snap3',x,z})`, como hace `tools/bench3d.mjs`).
2. Capturas de día (`hora=13`) y de noche (`hora=23`), 1280×720 y 360×740, calidad media y baja (`localStorage dq3_calidad`). Míralas de cerca y de lejos.
3. `node tools/arnes_mmo.mjs` (1483 bien, 0 mal), sintaxis de módulos, `tools/qa_movil.mjs`, `tools/qa_menu.mjs`, `tools/bench3d.mjs`, consola sin errores.

## Qué NO tocar
- `dq_lib.py`, `construir.mjs`, `foto.py`, `_correr.py`, `modelado.js` y el bloque `floraPropia`/`lodCerca`/`cullFlora` de `mundo.js`: son comunes. Si te falta algo, ponlo en TU `modelos/<familia>.py` (puedes definir ayudas ahí, como hace `arboles.py`) y apúntalo en tu informe.
- El archivo y el paquete de otra familia. Posiciones, radios y densidades de la flora; el servidor; el duende, las skins, monstruos y PNJ; `?v=`, `VERSION`, `sw.js`.
- `assets/3d/dq_indice.json` se genera: si choca al fusionar, se resuelve con `node tools/blender/construir.mjs --indice`. Sube al repo tus `dq_<familia>.json`, `.bin` y `.bin.gz`.

## Trampas
- Semillas fijas (`azar(semilla)`): mismo guion → mismo modelo. Un generador por parte (tronco, ramas, copa) para que quitar malla en un nivel no cambie el resto.
- `remallar` y `masa` borran color y marcas: pinta después. `decimar` los conserva.
- Las láminas sueltas necesitan `dos_caras` (el juego dibuja una sola cara).
- Un tubo de pocos lados ya sale suave; con tapas planas llama a `suavizar(o, 30)`.
- Blender tarda ~1 s por modelo; la primera foto con EEVEE, ~25 s (`--rapido` usa Workbench).
