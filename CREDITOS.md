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

## Packs descargados y aún sin integrar

`recursos/` guarda 14 packs CC0 más (mapas Tiled, enemigos animados, un jefe
dragón, iconos). No se publican (`recursos` está en `.assetsignore`). El
detalle de cada uno, con autor, URL y licencia, está en `recursos/INDICE.md`.
Al integrar cualquiera, añadirlo a este archivo.

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
