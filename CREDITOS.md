# Créditos de assets de terceros

DUENDE QUEST usa material de terceros. Todo lo listado aquí es **CC0 (dominio
público)**: se puede usar comercialmente y **no obliga a atribuir**. Este
archivo existe porque acreditar es lo correcto, no porque la licencia lo exija.

## Efectos de sonido

**The Essential Retro Video Game Sound Effects Collection** — Juhani Junkala
(SubspaceAudio). Licencia CC0.
https://opengameart.org/content/512-sound-effects-8-bit-style

Se usan 9 de los 512 efectos, convertidos a Ogg Vorbis mono de 22 kHz
(`audio/sfx/`): corte, corte2, golpe, muerte, explosion, moneda, salto, caida
y boton.

## Texturas de partículas

**Particle Pack** — Kenney. Licencia CC0.
https://kenney.nl/assets/particle-pack

Se usan 3 de las 200 texturas, reescaladas de 512×512 a 64×64 (`assets/fx/`):
halo, chispa y humo.

## Efectos de corte, muerte y descarga

**Sideview Fantasy Collection** (FX de Grotto Escape 2) — ansimuz. Licencia CC0.
https://opengameart.org/content/sideview-fantasy-collection

Se usan 5 efectos, unidos en tiras por `tools/generar_fx.py` (`assets/fx/`):
corte_h, corte_arriba y corte_giro (los tres golpes del combo), muerte y
rayo (el arma CHISPA).

## Enemigo "normal" animado

**Goblin Corps (MV Platformer set)** — Moikmellah. Licencia CC0.
https://opengameart.org/content/goblin-corps-mv-platformer-set

Se usa la variante `soldier`, recortada a las dos filas que hacen falta
(caminar + daño/muerte) por `tools/generar_enemigos_cc0.py`
(`assets/enemigos/sheets/goblin_normal.png`). Sustituye al bitmap estatico
deformado por codigo que llevaba el enemigo "normal" desde el principio del
proyecto.

## Fondos parallax de los biomas

**GothicVania Cemetery**, **GothicVania Swamp** y **GothicVania Rocky Pass** —
ansimuz. Licencia CC0.
https://opengameart.org/users/ansimuz

`tools/generar_fondos_cc0.py` compone sus capas en `assets/fondos/`: noche
(cementerio), selva (pantano), desierto (cañón), y amanecer y tormenta
recoloreados a partir de los mismos. Sustituyen a las siluetas que generaba
`tools/generar_parallax.py`.

## Segundo enemigo animado: esqueleto

**MV Platformer Skeleton** — Moikmellah. Licencia CC0.
https://opengameart.org/content/goblin-corps-mv-platformer-set (mismo autor
y set que el goblin de arriba)

`tools/generar_esqueleto_cc0.py` recorta caminar/daño/KO en
`assets/enemigos/sheets/esqueleto.png`. Aparece junto al goblin en los
biomas NOCHE y TORMENTA (`SHEET_POR_BIOMA` en `js/engine.js`).

## Tercer y cuarto enemigo animado: goblin samurai, goblin mago y hongo

**Goblin Corps (MV Platformer set)** — Moikmellah. Licencia CC0.
https://opengameart.org/content/goblin-corps-mv-platformer-set

Dos variantes mas del mismo pack usado para el goblin "normal" (arriba):
`samurai` y `mage`, misma rejilla 32x64 y mismas columnas que `soldier`
(confirmado a ojo, no solo por el texto de `FRAMES.txt` — ver
`tools/generar_goblin_variantes_cc0.py`). El samurai va a **DESIERTO
DORADO** (`assets/enemigos/sheets/goblin_samurai.png`) y el mago a
**TORMENTA ARCANA**, sumandose al esqueleto que ya estaba ahi
(`assets/enemigos/sheets/goblin_mage.png`).

**Animated Mushroom Monster Pixel Art (Big Mushroom)** — Scratchio.
Licencia CC0.
https://opengameart.org/content/animated-mushroom-monster-pixel-art

Primer enemigo animado que no es un humanoide reskineado. El pack trae cada
animacion en una tira PNG separada (caminar, daño, morir); se re-empaquetan
en una sola hoja de 2 filas con `tools/generar_hongo_cc0.py`
(`assets/enemigos/sheets/hongo.png`). Va en **SELVA ESMERALDA**, junto al
goblin.

## Quinto, sexto y septimo enemigo animado: goblin peasant, goblin assassin y lagarto

**Goblin Corps (MV Platformer set)** — Moikmellah. Licencia CC0.
https://opengameart.org/content/goblin-corps-mv-platformer-set

Dos variantes mas del mismo pack usado para el goblin "normal": `peasant`
(tunica marron, sin casco) y `assassin` (traje azul-morado oscuro con
capucha), misma rejilla 32x64 y mismas columnas que soldier/samurai/mage
(confirmado a ojo con las 7 variantes sueltas que quedaban, no solo estas
dos — ver `tools/generar_goblin_variantes2_cc0.py`). El peasant va a
**AMANECER ROJO** (`assets/enemigos/sheets/goblin_peasant.png`), que hasta
esta tanda era el unico bioma con un solo enemigo con hoja; el assassin va a
**NOCHE** (`assets/enemigos/sheets/goblin_assassin.png`), sumandose al
esqueleto.

**Sideview Fantasy Patreon Collection** (Grotto Escape 2 - Lizzard) — Luis
Zuno (ansimuz). Licencia CC0.
https://opengameart.org/content/sideview-fantasy-patreon-collection

Segundo enemigo animado que no es un humanoide reskineado, y primero con
rejilla propia muy chica (celda 64x32, dibujo real de 11-17 px de alto). El
pack trae `walk.png` y `hurt.png` como tiras sueltas pero SIN frames de
muerte; `tools/generar_lagarto_cc0.py` re-empaqueta caminar + daño y reusa
el ultimo frame de daño como pose de "muerte" (se desvanece por el
fade-out de alpha que ya aplica el motor a todo enemigo con hoja). Va en
**DESIERTO DORADO** (`assets/enemigos/sheets/lagarto.png`), junto al goblin
samurai.

`SHEET_POR_BIOMA` en `js/engine.js` tiene el reparto final por bioma.

## Octavo, noveno y decimo enemigo animado: goblin centurion, goblin battlelord y serpiente

**Goblin Corps (MV Platformer set)** — Moikmellah. Licencia CC0.
https://opengameart.org/content/goblin-corps-mv-platformer-set

Dos variantes mas del mismo pack usado para el goblin "normal": `centurion`
(piel canela, vincha roja, torso desnudo) y `battleLord` (piel canela,
vincha/cresta verde, armadura de cuero con placas), misma rejilla 32x64 y
mismas columnas que las 5 variantes previas (confirmado a ojo con las 5
sueltas que quedaban en `full/`, no solo estas dos — ver
`tools/generar_goblin_variantes3_cc0.py`). Las dos van a **SELVA ESMERALDA**
(`assets/enemigos/sheets/goblin_centurion.png` y `goblin_battlelord.png`),
que hasta esta tanda era el bioma con menos variedad (solo goblin_normal +
hongo): la piel canela y las vinchas se leen como guerreros tribales de la
jungla, en vez de soldados uniformados como el resto de reskins. `guard`,
`knight` y `lord` (piel gris, armadura metalica generica) se dejaron sin
usar: no encajan con jungla y se guardan para un bioma tipo castillo si
aparece mas adelante.

**Sideview Fantasy Patreon Collection** (Grotto Escape 2 - Snake) — Luis Zuno
(ansimuz). Licencia CC0.
https://opengameart.org/content/sideview-fantasy-patreon-collection

Tercer enemigo animado que no es un humanoide reskineado (mismo pack que dio
el lagarto). Rejilla propia (celda 27x20 caminar, 24x20 daño, cada
animacion en su propio PNG suelto). Igual que el lagarto, el pack no trae
frames de muerte: `tools/generar_serpiente_cc0.py` re-empaqueta caminar +
daño y reusa el ultimo frame de daño (el mas replegado) como pose de
"muerte", con el mismo fade-out por alpha del motor. Va en **DESIERTO
DORADO** (`assets/enemigos/sheets/serpiente.png`), junto al goblin samurai y
el lagarto — la sugerencia original de `recursos/INDICE.md` ya emparejaba
lagarto y serpiente como fauna de cañon rocoso, y aqui se confirmo a ojo.

`SHEET_POR_BIOMA` en `js/engine.js` tiene el reparto final por bioma.

## Jefe final de la campaña: ángel

**GothicVania Church** — Luis Zuno (ansimuz). Licencia CC0.
https://opengameart.org/content/gothicvania-church-pack

Hasta ahora el único jefe del juego era `oso` (`JEFES` en `js/engine.js`):
un oso reciclado por bioma vía tinte de color, con nombre y repertorio de
ataques distintos según el bioma pero siempre el mismo bitmap estático
(`assets/enemigos/enemy2.png`). Este es el primer jefe con silueta propia,
usado SOLO en la etapa final de la campaña (5-3) — las otras 4 etapas con
jefe siguen usando el oso. `tools/generar_angel_cc0.py` empaqueta los 8
frames de "idle" (aleteo) como ciclo de movimiento y 2 de los 3 de
"angel-attack" como destello de golpe; el pack no trae daño ni muerte
propios, así que el último frame de ataque se reusa como pose de colapso
(mismo patrón que lagarto/serpiente). Se dibuja con el mismo sistema de
hoja que el resto del bestiario (`assets/enemigos/sheets/angel.png`) — el
código del jefe (`actualizarJefe`, telegrafiado de ataques) ya era
genérico y no necesitó ningún cambio para aceptar un sprite distinto del
oso. Se llama "ÁNGEL CAÍDO" en vez del nombre por bioma (`NOMBRES_JEFE`)
para no salir como "FARAÓN DORADO" solo por vivir en DESIERTO DORADO —
el oso reciclado que SIN FIN sigue mandando a ese mismo bioma cada 15
waves conserva ese nombre sin cambios.

## Decimoprimer y decimosegundo enemigo animado: ghoul ardiente y hechicero

**GothicVania Church** — Luis Zuno (ansimuz). Licencia CC0.
https://opengameart.org/content/gothicvania-church-pack

Mismo pack que dio el ángel (arriba), del que quedaban dos sprites sin usar
que `recursos/INDICE.md` ya marcaba: el "burning-ghoul" y el "wizard".

El **ghoul ardiente** (`assets/enemigos/sheets/ghoul_ardiente.png`,
`tools/generar_ghoul_ardiente_cc0.py`) es el cuarto enemigo no-humanoide
(despues de hongo/lagarto/serpiente). Va a **TORMENTA ARCANA**, que hasta
esta tanda no tenia ningun enemigo de fuego (solo goblin mago/esqueleto,
temática arcana/eléctrica) — `recursos/INDICE.md` ya lo describía como "el
enemigo de fuego que faltaba". El pack trae dos variantes de paleta (v1/v2,
misma pose); se usó v1 porque encaja mejor con la paleta violeta de
TORMENTA. Solo trae un ciclo de carrera (7 de 8 frames sueltos quedan
dentro del tag de animación del pack, el 8vo queda fuera): sin daño ni
muerte propios, se reusan el último frame del ciclo + el frame suelto (el
más extendido) como flash de golpe, y el frame suelto otra vez como pose de
colapso — mismo patrón que lagarto/serpiente/ángel.

El **hechicero** (`assets/enemigos/sheets/hechicero.png`,
`tools/generar_hechicero_cc0.py`) es el "wizard" del pack, que
`recursos/INDICE.md` marcaba sin revisar como posible mini-jefe. Se llama
"hechicero" y no "mago" para no confundirse con goblin_mage (el párrafo de
arriba en este mismo archivo). Mirado a ojo (previews `idle.gif`/`fire.gif`
del pack) no lee como jefe: no tiene fase 2, ni ataque propio telegrafiado,
y su altura de dibujo real es parecida al resto del bestiario "normal" —
solo se ve más grande por la túnica ancha, no por estatura. Intentar un
jefe nuevo sin poder probar el telegrafiado de ataques en partida real era
el riesgo que este reparto de tareas pedía evitar, así que se integró como
enemigo normal (el patrón más simple, `SHEETS`/`SHEET_POR_BIOMA`, ya
probado 11 veces). Va a **NOCHE**, no a TORMENTA como sugería la fila
original de `recursos/INDICE.md` (esa sugerencia era para cuando esto era
candidato a jefe): TORMENTA ya tiene al goblin mago y en esta misma tanda
suma al ghoul de arriba, así que hubiera quedado con 5 variantes mientras
NOCHE se quedaba en 3; la túnica violeta oscura y la capucha leen mejor
como "nigromante de cementerio" junto al esqueleto y el goblin assassin
(los dos ya "acechan de noche", ver más arriba). El pack no trae una tira
de "caminar" con piernas (túnica larga, casi sin pies visibles a la
vista): se usa el ciclo de "Idle" (manos quietas) como fila de movimiento,
igual patrón que lagarto/serpiente cuando su "caminar" tampoco mostraba
desplazamiento de piernas — el desplazamiento en X ya lo hace el código del
motor, no el dibujo. Sin daño/muerte propios: el golpe reusa 3 frames del
conjuro de "Fire" subiendo de intensidad (manos cada vez más arriba), y la
muerte reusa el frame final de descarga como pose de colapso.

`SHEET_POR_BIOMA` en `js/engine.js` tiene el reparto final por bioma.

## Segunda variante de fondo (amanecer, selva, tormenta)

**Sunny Land** (ya listado en `recursos/INDICE.md`) — ansimuz. CC0.
**Parallax Forest Pack** — ansimuz. CC0.
https://opengameart.org/content/forest-background
**Castle Platformer ("working title" assets)** — Jetrel. CC0.
https://opengameart.org/content/castle-platformer

`tools/generar_fondos_variantes.py` genera `amanecer2`, `selva2` y
`tormenta2` en `assets/fondos/`. El motor elige al azar entre las dos
variantes de cada bioma al entrar (`FONDO_VARIANTES` en `js/engine.js`),
para que la campaña no se vea igual la segunda vez.

## Decimotercer al decimoseptimo enemigo animado: goblin guard, goblin knight, rana, fantasma y pájaro

**Goblin Corps (MV Platformer set)** — Moikmellah. Licencia CC0.
https://opengameart.org/content/goblin-corps-mv-platformer-set

Últimas dos variantes sin usar del mismo pack: `guard` (armadura gris lisa,
penacho verde chico) y `knight` (misma armadura, cresta/mohawk ROJO en el
casco), misma rejilla 32x64 y mismas columnas que las 8 variantes previas
(confirmado a ojo con las 3 sueltas que quedaban en `full/`, no solo estas
dos — ver `tools/generar_goblin_variantes4_cc0.py`). Las dos van a
**AMANECER ROJO** (`assets/enemigos/sheets/goblin_guard.png` y
`goblin_knight.png`), que hasta esta tanda era el bioma con menos variedad de
todo el juego (solo goblin_normal + goblin_peasant): el knight ademas conecta
con la paleta del bioma via su cresta roja (línea de acento `#ff6444` en
`BIOMES`). `guard`/`knight` leen como soldados de guarnición sin más, a
diferencia de la tercera variante que quedaba (`lord`: corona + capa/tunica
larga), que se descartó — ver más abajo.

**Sideview Fantasy Patreon Collection** — Luis Zuno (ansimuz). Licencia CC0.
https://opengameart.org/content/sideview-fantasy-patreon-collection

Tres enemigos más del mismo pack que ya dio lagarto y serpiente, ninguno
humanoide reskineado:

- **rana** (`sunny-froggy`, `assets/enemigos/sheets/rana.png`,
  `tools/generar_rana_cc0.py`): va a **SELVA ESMERALDA**, junto al hongo y
  los goblins tribales — la fila `caminar` (42x38) y la de `taunting`
  (53x42, reusada para golpe/muerte) traen celdas de tamaño DISTINTO en
  ambos ejes, no solo el ancho como en la serpiente: se empaquetaron en una
  celda común 53x42 con `caminar` centrada horizontalmente y anclada al
  borde inferior, para que las patas no salten de posición al cambiar de
  fila. Sin daño/muerte propios: el golpe reusa el frame de "croar con la
  boca abierta" + la única pose distinta del ciclo de taunting (torcida), y
  la muerte reusa esta última.
- **fantasma** (`enemy-ghost`, `assets/enemigos/sheets/fantasma.png`,
  `tools/generar_fantasma_cc0.py`): va a **NOCHE VIOLETA**, junto al
  esqueleto, el goblin assassin y el hechicero (cementerio nocturno) — cráneo
  flotando en una capa negra con partículas magenta, se usó la variante
  "con partículas" del pack por el toque extra de caracter espectral. Ciclo
  único de flotar (6 frames, sin tag de animación separado): el golpe y la
  muerte reusan los frames finales del mismo ciclo (la capa más abierta),
  igual patrón que el ghoul ardiente.
- **pájaro** (`flying-bird`, `assets/enemigos/sheets/pajaro.png`,
  `tools/generar_pajaro_cc0.py`): va a **AMANECER ROJO**, junto al goblin
  guard/knight — "pájaros al amanecer" es la lectura más directa de
  `recursos/INDICE.md` ("pájaro → cualquiera"). Se usó la paleta
  crema/hueso del pack (no la variante "-skin" azul/naranja, que lee más a
  loro tropical y hubiera encajado mejor en selva, ya reforzada esta misma
  tanda con la rana). Ciclo único de vuelo (7 frames): golpe y muerte reusan
  las posturas de ala más extendida del mismo ciclo.

`SHEET_POR_BIOMA` en `js/engine.js` tiene el reparto final por bioma.

## Lo que se dejó sin integrar esta tanda, y por qué

- **goblin lord** (Goblin Corps, corona + capa/túnica larga sobre la misma
  armadura de guard/knight): a diferencia de esos dos, la corona lo lee
  inequívocamente como REALEZA — un "rey goblin" que necesita una escena de
  trono/castillo para tener sentido narrativo. Ningún bioma actual (noche,
  amanecer, selva, tormenta, desierto) sostiene esa lectura sin que se sienta
  fuera de lugar. Se guarda en `recursos/` para el mismo hipotético bioma
  castillo que ya mencionaba `recursos/INDICE.md`.
- **dragón volador** (`sunny-dragon`, Sideview Fantasy Collection, celda
  192x176, el más grande de todo el lote): se miró de cerca (los 9 frames de
  `sunny-dragon-fly.png`) aplicando el mismo criterio que ya se usó con el
  "wizard"/hechicero en la tanda anterior. A diferencia del hechicero, que sí
  tenía dos tags de animación separados (Idle + Fire) de donde sacar un golpe
  con sentido, el dragón trae **un único ciclo de vuelo continuo** (aleteo),
  sin ninguna pose de ataque, daño o telegrafiado propio — ni siquiera una
  variación de postura que sugiera "en picada" o "escupe fuego". No lee como
  jefe (sin fase 2 ni ataque propio que telegrafiar, el mismo motivo por el
  que el hechicero no se integró como jefe) pero tampoco vale la pena
  integrarlo como enemigo normal: su única razón de ser es la escala (dragón
  grande, "mini-jefe" en el propio nombre del pack), y encogerlo al
  `altoObjetivo: 70` de todo el bestiario normal —igual que se hizo con el
  pájaro, que sí es una criatura chica de verdad— desperdiciaría exactamente
  lo que lo hace interesante. Sin poder verificar en partida real un
  telegrafiado de ataque nuevo (la limitación explícita de este reparto de
  tareas), forzar un jefe a medias era peor que dejarlo pendiente. Se guarda
  en `recursos/` para una tanda futura con más margen para diseñar y probar
  un ataque propio.

## Packs descargados y aún sin integrar

`recursos/` guarda más packs CC0 sin integrar del todo (mapas Tiled, un jefe
dragón —ver más arriba—, iconos), más lo que queda sin tocar de Goblin Corps
(`lord`, ver más arriba) y del resto de Sideview Fantasy Collection (el
dragón volador; ya se integraron lagarto, serpiente, rana, fantasma y
pájaro). No se publican (`recursos` está en `.assetsignore`). El detalle de
cada uno, con autor, URL y licencia, está en `recursos/INDICE.md`. Al
integrar cualquiera, añadirlo a este archivo.

---

## Lo que NO se usó, y por qué

Durante la búsqueda se descartaron dos fuentes muy recomendadas en foros:

- **BDragon1727** (efectos y balas 16×16): su licencia dice literalmente *"Free
  to use on non-commercial games... If you will be using on a commercial game,
  please contribute"*. DUENDE QUEST tiene monetización, así que el uso gratuito
  no ampara al proyecto.
- **CraftPix** (fondos gratuitos): permite uso comercial, pero prohíbe
  redistribuir el arte "de forma que resulte utilizable por otro usuario final".
  En un juego HTML5 los PNG se sirven en URLs públicas y cualquiera los descarga
  desde el inspector del navegador. Probablemente esté cubierto, pero es una
  ambigüedad que con CC0 sencillamente no existe.

Tampoco se usaron las paletas de **Lospec** ni el pack de impactos de
**Frostwindz**: ninguna de las dos páginas declara licencia, y sin licencia
declarada la interpretación por defecto es "todos los derechos reservados".

## Assets generados por código

Hasta el 28-sep-2026 las capas de parallax las generaba
`tools/generar_parallax.py` con la paleta del array `BIOMES`. Se sustituyeron
por los fondos CC0 de ansimuz (arriba), que tienen detalle de pixel art real;
el script antiguo se conserva por si se quiere volver.
