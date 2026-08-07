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

Las capas de parallax (`assets/fondos/`) no vienen de ningún pack: las genera
`tools/generar_parallax.py` con la paleta exacta del array `BIOMES` del motor.
Se hizo así a propósito, para que encajen con los colores del juego en vez de
traer los de otro artista.
