# Trajes 3D de las skins del duende (guía para quien rehace una skin)

Cada skin del juego (`SKINS` en `mmo/js/data.js`) tiene aquí su traje 3D: `mundo/js/skins/<id>.js`.
Tu trabajo es que el duende 3D **se parezca a la imagen del dueño** de esa skin, renderizando y
comparando en el taller hasta que se parezca. Tocas **solo tu archivo**. No edites `modelos.js`,
`skins3d.js`, `data.js` ni el archivo de otra skin.

- Esta carpeta y `mundo/taller.html` no se publican (`.assetsignore`). El juego solo carga
  `mundo/js/skins3d.js`, que genera el integrador con `node tools/unir_skins.mjs`. **No lo ejecutes tú**
  (lo pisarías a otros agentes). Tú solo validas tu archivo: `node tools/unir_skins.mjs --revisar <id>`.
- Si tu traje lanza un error, el juego no se cae: ese duende se arma con el aspecto de reserva
  (colores de `ROPA_SKIN` en `modelos.js`) y el taller te enseña el error en rojo.

## 1. Lo que NO cambia: la mascota

El duende es la mascota del dueño (mira `refs/mascota_brindando.png`, `refs/mascota_letrero.png`,
`assets/lore/duende-chicha.webp`). Estos rasgos los pone la base (`humano()` + `partesMascota()` +
`formaDuende()` en `modelos.js`) y son **iguales en todas las skins**. No los tapes ni los rehagas:

- Estilo de **bloques**: cabeza CÚBICA verde lima (`K.PIEL` = `#8fd14f`), casi tan grande como el cuerpo.
- **Dos espadas de píxeles** (marrón y naranja, en escalera) cruzadas detrás de la cabeza. Asoman SIEMPRE,
  también con sombrero (en las imágenes salen por detrás del sombrero de bruja, del tricornio, de la calavera).
- **Orejas grandes** en punta hacia los lados, con el interior naranja. Los sombreros se apoyan encima,
  no las tapan (las capuchas cerradas que las esconden restan parecido).
- **Ojos azules grandes**, cejas en bloque, nariz cuadrada, mejillas redondas, **sonrisa ancha con dientes y colmillos**.
  La cara se tiene que ver: nada de máscaras que tapen ojos y boca (un parche en un ojo o unas vendas alrededor, sí).
- **Manos grandes** verdes y **botas grandes** de bloque.
- La piel es siempre verde: una skin cambia la ROPA, el PELO/SOMBRERO y los ACCESORIOS, no la especie.
- El vaso de chicha de las imágenes NO va en la mano: en el juego la derecha lleva el arma y la izquierda
  el escudo o la segunda daga. (Si quieres el guiño, que cuelgue pequeño del cinturón.)
- El poncho andino azul/amarillo/blanco es el traje de la skin `comun`; las demás llevan el suyo.

## 2. El contrato

```js
// mundo/js/skins/<id>.js — SIN imports, sin document/window/fetch: todo llega por parámetro.
const base = { ropa: '#5a3a1e', pantalon: '#3b2616', botas: '#4a2a16', acento: '#c9a227' };
export default {
  id: 'pirata',                 // igual que el nombre del archivo
  base,                         // colores con los que humano() arma el cuerpo (abajo)
  cuerpo: { },                  // opcional: opciones extra de humano() (casi nunca hace falta)
  escudoClase: false,           // opcional: el guerrero NO lleva escudo con esta skin (p. ej. si la zurda es un garfio)
  cabeza(r, K, ctx) { ...; return 'sombrero'; },   // opcional: lo de la cabeza; devuelve el TOCADO
  vestir(r, K, ctx) { ... },                       // opcional: ropa y accesorios de cuerpo, brazos, piernas, manos
};
```

- `base` (todos `'#rrggbb'`): `ropa` (torso; y mangas si no das `mangas`), `pantalon` (piernas y cadera),
  `botas`, `acento` (cuello y hebilla del genérico), y opcionales `cinto` (banda de la cintura; sin él, cuero oscuro),
  `mangas` (brazos y hombros de otro color: camisa bajo chaleco), `manos` (guantes; sin él, piel verde),
  `hojaNeon` (la katana pasa a ser una hoja de luz de ese color).
- `cabeza(r, K, ctx)` devuelve el **tocado**, que decide cuánto del peinado del jugador se dibuja después:
  `''` (nada: se ve el peinado entero) · `'gorra'` (tapa la coronilla: casi no se ve pelo) · `'casco'` ·
  `'sombrero'` · `'capucha'` (solo asoma el pelo de la nuca) · `'peluca'` (**tu skin trae su propio pelo**:
  no se dibuja el del jugador; úsalo en vampiro, lobo, frankenstein, juez...).
- `vestir(r, K, ctx)` puede devolver un tocado nuevo (o nada). Si llamas a `K.generico`, devuelve lo que te dé.
- Si la skin no define `vestir`, se dibuja solo el cuello y la hebilla genéricos.

### Quién manda en la cabeza
1. Un `atuendo` pasado a `crearDuende` (PNJ aventureros) o el disfraz del editor de aspecto (`look.disfraz`).
2. Si no hay, **`cabeza()` de tu skin**. La clase NO pone su casco/sombrero/capucha encima.
3. Solo si tu skin no define `cabeza`, el tocado de la clase (casco con cuernos, sombrero de mago, capucha).

La clase se sigue leyendo siempre por: el **arma** en `r.manoD` (katana/odachi/chispa; **dagas en las dos manos**;
mago y sacerdote llevan bastón), el **escudo redondo del guerrero** en `r.manoI` (salvo `escudoClase: false`) y el
**halo del sacerdote** sobre la cabeza (a 0,8·H: no lo tapes con un sombrero altísimo). El arma, el grado de forja
y el aura del suelo son genéricos: no los dibujes tú. Antes de poner algo en una mano mira
`ctx.clase === 'guerrero'` (escudo en la izquierda) y `ctx.arma === 'dagas'` (daga en la izquierda).

### `ctx`
`{ skin, sk (fila de SKINS), clase ('guerrero'|'mago'|'sacerdote'|'picaro'|null), arma, lk (look del jugador:
cara, cuerpo, pelo, colorPelo...), cpo ({ ancho, panza, grueso } de su complexión), T, L, A, H, ligero, grado,
PIEL, base (tus colores ya resueltos), colorClase, tocado (el que haya hasta ese momento) }`

## 3. Unidades, ejes y pivotes

- "Metros de diseño": al final el modelo entero se escala para medir 1,75 m × altura del jugador.
  **Pies en y = 0, mira a +Z, +X es la IZQUIERDA del personaje** (I = +x, D = −x).
- Medidas del duende: `L = 0.45` (pierna), `T = 0.46` (torso), `A = 0.38` (brazo), `H = 1.18` (escala de la cabeza).
  Complexión del jugador: `W = ctx.cpo.ancho` (0.8 / 1 / 1.2) y `P = ctx.cpo.panza` (0.78 / 1 / 1.42).
  **Multiplica por W y P los anchos de lo que rodea el torso** o al robusto le atravesará la barriga.
- Pivotes (lo que cuelgues de cada uno se mueve con él y se funde en su malla):

| Pivote | Dónde está su origen | Qué hay alrededor (en sus coordenadas) |
|---|---|---|
| `r.raiz` | el suelo, entre los pies | no se anima: solo auras/humo del suelo |
| `r.cuerpo` | la cadera `(0, L, 0)` | torso: elipsoide centrado en `y = T·0.5`, radios `(0.27·W·P, T·0.58, 0.22·P)`; pecho delante en `z ≈ 0.2·P + 0.01`; cadera: caja `0.34·W × 0.14 × 0.22` en `y = 0.02`; cintura `y = T·0.18`; cuello `y = T·0.97` |
| `r.cabeza` | la base del cuello `(0, T + 0.01, 0)` en el cuerpo | cubo: `x ±0.27·H`, `y` de `0.02·H` a `0.52·H`, `z ±0.25·H` (cara en `z = +0.25·H`); ojos `(±0.12·H, 0.31·H)`, cejas `y = 0.415·H`, nariz `y = 0.215·H`, boca `y = 0.10·H`; orejas: nacen en `(±0.24·H, 0.30·H, −0.03·H)` y salen 0.62·H hacia fuera y arriba; espadas de píxeles en `z = −0.2·H` (grosor 0.05·H), en escalera de `(±0.13·H, 0.40·H)` a `(±0.62·H, 0.82·H)`: deja libre ese pasillo detrás de la cabeza; `r.topeCabeza = 0.54·H` |
| `r.bI`, `r.bD` | el hombro `(±(0.216·W·P + 0.09), T·0.84, 0)` | el brazo cuelga hacia `−y` hasta `y = −A`; grosor ≈ 0.07·grueso; mano: bola de radio 0.10 en `y = −A − 0.02` |
| `r.manoI`, `r.manoD` | el centro de la mano | grupos fijos dentro del brazo (el arma está en `manoD`) |
| `r.pI`, `r.pD` | la cadera de cada pierna `(±0.12·W, L, 0)` | la pierna cuelga hasta `y = −L`; bota: caja `0.17 × 0.12 × 0.26` en `(0, −(L − 0.06), 0.04)` más la puntera |

- Animaciones que te regala el rig (no puedes ejecutar código por cuadro): los pivotes de arriba se mueven solos
  (andar, correr, atacar, respirar). Además, con un pivote tuyo `const g = K.piv(r, K.G(padre, pos))`:
  `r.giran.push([g, velocidad])` gira sobre Y · `r.flamas.push(g)` parpadea como llama · `r.brillo.push(g)` late ·
  `r.cola = g` se menea como cola (amplitud `r.colaAmp`, 0.3 por defecto).

## 4. La caja de herramientas `K`

| Herramienta | Qué hace |
|---|---|
| `K.M(padre, geo, color, pos, escala, rot, opMat)` | una pieza. `geo` = nombre de geometría; `color` = `'#rrggbb'` o un material de `K.mat`; `pos` = `[x, y, z]`; `escala` = número o `[x, y, z]`; `rot` = `[x, y, z]` en radianes. Devuelve la malla |
| `K.MF(padre, partes, color?, opMat?, pos?, escala?)` | MUCHAS piezas en una sola malla. `partes = [[geo, '#color', pos, escala, rot], ...]` (colores en texto: usa `K.hx(c)` si vienen de `osc`/`mez`). Con `color`, todas de ese color (pon `null` en cada parte). `escala` final = `H` si escribes en unidades de cabeza. **Prefiérela siempre** |
| `K.G(padre, pos?, rot?)` | grupo vacío (para colocar un conjunto) |
| `K.piv(r, grupo)` | lo marca como pivote animable (vuelve a su reposo cada cuadro). Máximo 4 nuevos |
| `K.fuera(obj)` | lo saca de la medida de altura. **Obligatorio** en todo lo que sobresale por arriba de la cabeza o por debajo de los pies (sombreros, cuernos, capas largas, colas, cosas en la mano); si no, el duende entero encoge |
| `K.mat(color, { e, op, ds, aura })` | material compartido: `e` brillo propio 0..1, `op` opacidad, `ds` dos caras, `aura` aditivo sin luz |
| `K.hx(c)` · `K.osc(c, k)` · `K.mez(a, b, k)` | color a `'#rrggbb'` · oscurecer (k < 1) o aclarar · mezclar dos colores (devuelven `THREE.Color`: pásalos por `K.hx` dentro de `MF`) |
| `K.ACC` | tocados hechos: `casco(r, c, cuernos?)`, `sombrero(r, c, alto)`, `paja(r, c)`, `gorra(r, c)`, `capucha(r, c)`, `mascara(r, c)`, `halo(r, c)`, `corona(r, c, esc)`, `romano`, `yelmo`, `kabuto`, `barba(r, c)`. Son redondos (de antes de la cabeza cubo): mejor haz el tuyo con cajas |
| `K.capa(r, color, T, L)` · `K.hombreras(r, color, pua?)` | capa plana a la espalda · hombreras |
| `K.espada(mano, o)` · `K.escudo(mano, c, forma, borde)` · `K.baston(r, mano, c)` | por si tu skin lleva un arma de adorno (no la del jugador) |
| `K.auraSuelo(r, c, radio)` | anillo en el suelo (las premium ya traen el suyo: no lo dupliques) |
| `K.generico(r, banderas, ctx)` | los adornos de siempre. Sin banderas: cuello y hebilla. Banderas: `poncho: [fondo, franja, franja2]`, `corbata`, `capa`, `corona: true` (+ `gemas: true`), `neon`, `hombreras: true` (+ `puas`), `tunica` (+ `borde`), `ribete`, `codigo`, `capucha`, `peluca`, `chorrera`, `ojosBrillo`, `orbe`, `humo`, `runas`, `teclado`, `movil: true`, `mazo`, `visor`, `llamas` (valor = color salvo donde dice `true`). Devuelve el tocado |
| `K.atuendo(r, id)` | cabezas con nombre de antes: `pirata`, `bruja`, `vampiro`, `momia`, `militar`, `campesino`, `frankenstein`, `lobo`, `esqueleto`. Devuelve su tocado |
| `K.PIEL` · `K.PI` · `K.THREE` · `K.geos` | verde de la piel · π · three.js (evítalo: usa M/MF) · lista de geometrías |

Geometrías (`FABRICA`, todas de tamaño 1 y se escalan): `caja` (cubo centrado: **la pieza del estilo, 12 triángulos**) ·
`esfera` (radio 1, 120 tri.) · `esferaB` (esfera barata) · `semi` (cúpula, y de 0 a 1) · `cil` (cilindro centrado) ·
`cilT` (cilindro que cuelga desde y = 0, más fino abajo) · `tronco` (cono truncado con la base en y = 0) ·
`cono` y `cono4` (pirámide; base en y = 0, punta en y = 1) · `icos` · `toro` (aro horizontal, 180 tri.: caro) ·
`anillo` (plano, del suelo) · `corona` · `ala`, `pluma` (planas, hacia +x) · `aleta`, `colaPez`.

### Qué se funde y qué no
Al terminar, todas las piezas fijas que cuelgan de un mismo pivote se hornean en UNA malla (un draw call).
Se funden: piezas opacas de `M`/`MF`, también las que brillan con `{ e }`. **No se funden** (cada una es una
"malla suelta", un draw call más): transparentes (`op < 1`), `aura`, `ds`, las que marques con
`malla.userData.sinFlash = true` (no se ponen blancas al recibir un golpe) y las de escala negativa.

## 5. Presupuesto (el taller te lo cuenta abajo a la izquierda)
- ≤ **120 piezas** añadidas por el traje · ≤ **4 pivotes** nuevos · ≤ **3 mallas sueltas** · modelo entero ≤ **5 000 triángulos**.
- Todo colgado de pivotes que ya existen (cuerpo, cabeza, brazos, manos, piernas) para que se funda.
- Detalles de menos de 0,03 no se ven en el juego: el jugador se ve pequeño y casi siempre **de espaldas**.
  Gasta las piezas en la SILUETA (sombrero, capa, cola, hombros) y en la ESPALDA, no en botones.
- `ctx.ligero` (calidad baja, móviles baratos): no pongas mallas sueltas, auras, humo ni pivotes nuevos, y quita
  el detalle fino. Patrón: `if (!ctx.ligero) { ...adornos caros... }`. Debe seguir reconociéndose.
- Colores planos y saturados como en la imagen; sin texturas. Nada de `Math.random()` (el modelo se cachea).

## 6. El taller y la foto

```
node tools/foto_taller.mjs <id> "<carpeta temporal>/<id>.png"                     # sin clase, katana
node tools/foto_taller.mjs <id> salida.png --clase guerrero                        # con escudo
node tools/foto_taller.mjs <id> salida.png --clase mago                            # bastón (y --clase sacerdote: halo)
node tools/foto_taller.mjs <id> salida.png --clase picaro --arma dagas             # dagas en las dos manos
node tools/foto_taller.mjs <id> salida.png --cuerpo 0   (y --cuerpo 2)             # delgado y robusto
node tools/foto_taller.mjs <id> salida.png --ligero                                # calidad baja
node tools/foto_taller.mjs <id> salida.png --estado corre --accion lanza           # otras poses
node tools/foto_taller.mjs <id> salida.png --ref "<ruta>/refs/pirata.png"          # imagen grande a la izquierda
node tools/foto_taller.mjs <id> salida.png --archivo "<ruta>/variante.js"          # prueba otro archivo sin tocar el tuyo
node tools/unir_skins.mjs --revisar <id>                                           # valida tu archivo (sin escribir nada)
```

La foto (1600×900) trae: la imagen 2D, el duende de frente, tres cuartos, perfil, espalda, dos bustos, una pose de
acción y "como en el juego" (pequeño y de espaldas). **Mírala con Read** después de cada cambio. Si hay un error
sale un recuadro rojo con el mensaje y el comando termina con código 1. En el navegador:
`/mundo/taller.html?skin=<id>&clase=guerrero&arma=katana&estado=quieto&accion=ataca&cara=0` (con un servidor local).
La luz es la del juego de día (hemisferio + sol) y la salida es sRGB, como en `mundo.js`.

Lista de comprobación antes de terminar:
1. Sin clase, guerrero, mago, sacerdote y pícaro con dagas: nada atraviesa el escudo, el arma ni el halo.
2. Cuerpo 0 y cuerpo 2: la ropa no flota ni se hunde.
3. `--ligero`: 0 mallas sueltas del traje y se sigue reconociendo.
4. De espaldas y en "como en el juego" se distingue de las otras skins.
5. Presupuesto sin "SE PASA", sin errores de consola y `--revisar` bien.
6. El duende sigue midiendo lo mismo (si encogió, te falta un `K.fuera`).

## 7. Ejemplo completo comentado (un arriero con chullo; no es ninguna skin real)

```js
// mundo/js/skins/ejemplo.js
const base = { ropa: '#b8322a', pantalon: '#2b2b33', botas: '#3a2616', acento: '#f2c23a', cinto: '#5a3a1e', mangas: '#f4efe0' };
const ROJO = '#c0262d', ORO = '#f2c23a', AZUL = '#2f62c0', CUERO = '#5a3a1e';

export default {
  id: 'ejemplo',
  base,
  // CABEZA: un chullo de bloques. Coordenadas en unidades de cabeza (la escala final de MF es H).
  cabeza(r, K, ctx) {
    const g = K.fuera(K.G(r.cabeza));            // grupo fijo en la cabeza, fuera de la medida de altura
    const P = [
      ['caja', ROJO, [0, 0.57, 0], [0.58, 0.12, 0.54]],        // casquete: tapa el techo del cubo (que acaba en y = 0.52)
      ['caja', ORO, [0, 0.50, 0], [0.60, 0.04, 0.56]],         // cenefa
      ['caja', ROJO, [0, 0.67, 0], [0.40, 0.10, 0.38]],        // segundo piso
      ['caja', AZUL, [0, 0.75, 0], [0.20, 0.08, 0.20]],        // punta
      ['caja', ROJO, [0.2, 0.36, -0.27], [0.14, 0.3, 0.04]],   // orejeras: caen por DETRÁS de las orejas, sin taparlas
      ['caja', ROJO, [-0.2, 0.36, -0.27], [0.14, 0.3, 0.04]],
    ];
    if (!ctx.ligero) P.push(['caja', ORO, [0, 0.82, 0], [0.1, 0.08, 0.1]]);   // pompón: detalle que sobra en calidad baja
    K.MF(g, P, null, null, null, ctx.H);
    return 'gorra';                              // tapa la coronilla: del peinado del jugador casi no se dibuja nada
  },
  // CUERPO: chaleco abierto, faja, puños, vuelta de las botas y una alforja a la espalda.
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza;
    const zPecho = 0.2 * P + 0.02;               // justo delante del pecho, también en el robusto
    K.MF(r.cuerpo, [
      ['caja', CUERO, [0.11 * W * P, T * 0.55, zPecho], [0.12 * W * P, T * 0.6, 0.03]],     // solapa izquierda del chaleco
      ['caja', CUERO, [-0.11 * W * P, T * 0.55, zPecho], [0.12 * W * P, T * 0.6, 0.03]],    // solapa derecha
      ['caja', ORO, [0.06 * W * P, T * 0.6, zPecho + 0.02], [0.03, 0.03, 0.02]],            // botón
      ['caja', AZUL, [0, T * 0.2, 0], [0.5 * W * P, 0.09, 0.42 * P]],                       // faja ancha (se ve desde atrás)
      ['caja', CUERO, [0, T * 0.55, -(0.2 * P + 0.07)], [0.3 * W, 0.26, 0.1]],              // alforja a la espalda
      ['caja', ORO, [0, T * 0.62, -(0.2 * P + 0.125)], [0.22 * W, 0.04, 0.02]],             // su cinta
    ]);
    for (const b of [r.bI, r.bD]) K.M(b, 'caja', ORO, [0, -A + 0.05, 0], [0.16, 0.06, 0.16]);          // puños
    for (const p of [r.pI, r.pD]) K.M(p, 'caja', CUERO, [0, -L + 0.17, 0.03], [0.2, 0.05, 0.25]);      // vuelta de la bota
    // Adorno caro (una malla suelta que gira): solo en calidad normal, y no en la mano del escudo.
    if (!ctx.ligero && ctx.clase !== 'guerrero' && ctx.arma !== 'dagas') {
      const g = K.piv(r, K.fuera(K.G(r.manoI, [0, -0.02, 0.1])));                 // pivote nuevo (1 de 4)
      K.M(g, 'icos', K.mat(ORO, { e: 0.8 }), [0, 0, 0], 0.06).userData.sinFlash = true;   // moneda que brilla (malla suelta)
      r.giran.push([g, 2]);                                                       // gira sola
    }
    return K.generico(r, {}, ctx);               // cuello y hebilla de siempre (o quítalo y haz los tuyos)
  },
};
```
