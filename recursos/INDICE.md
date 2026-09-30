# Recursos de arte de terceros (sin integrar)

Descargados el 2026-09-28 (salvo `enemigos/ansimuz-hell-hound/`, del 2026-09-30 — ver su fila en la tabla). **Todo es CC0 (dominio público)**: uso comercial permitido y sin atribución obligatoria. Cada carpeta tiene su `LICENCIA.txt` (fuente, autor, URL de la licencia) y, si trae sprites animados, un `FRAMES.txt` con el tamaño de frame y las animaciones para cortarlos (o, si no lo trae, se midió a mano con PIL — ver el comentario del script `tools/generar_*_cc0.py` correspondiente).

Total aproximado: **21,7 MB, 14 packs**.

> **OJO, antes de publicar:** esta carpeta NO está todavía en `.assetsignore`, así que el Worker la serviría en público. Hay que agregar `recursos` a `.assetsignore` y copiar a `assets/` solo lo que se integre.

## Escala y estilo (léase antes de integrar)

- Los sprites actuales del juego son de alta resolución (el duende mide ~210 px de alto y los enemigos de `assets/enemigos/` entre 200 y 280 px). Todos estos packs son **pixel art de baja resolución** (personajes de 20 a 65 px, tiles de 16 o 18 px). Para que encajen hay que escalarlos x3–x5 con `imageSmoothingEnabled = false` y usar un único factor por bioma; si no, se mezclan tamaños de píxel y se nota.
- La paleta de ansimuz (Sunny Land, Gothicvania, Rocky Pass) es la más coherente entre sí: si se usan varios packs suyos, el juego queda homogéneo. Kenney es más plano y caricaturesco, y Moikmellah es más sobrio.
- Nada de esto trae neón de fábrica. El brillo neón se puede sumar por código (glow con `shadowBlur`/aditivo) sobre los sprites, o recolorear con las paletas que traen algunos packs.

## Tabla de packs

| Tipo | Nombre | Autor | Licencia | Ruta | Tamaño de frame / tile | Encaja en | Notas de estilo |
|---|---|---|---|---|---|---|---|
| Mapa | Pixel Platformer 1.2 | Kenney | CC0 | `mapas/kenney-pixel-platformer/` (570 KB) | Tiles 18×18 (1 px de separación), personajes 24×24 | **amanecer** (hierba), un poco de desierto (arena) y nieve | Trae **mapas Tiled `.tmx` + `.tsx`** listos. Estilo cute/plano, colores saturados. Incluye enemigos minúsculos 24×24 (poco útiles para un brawler). |
| Mapa + enemigos | Sunny Land | ansimuz | CC0 | `mapas/ansimuz-sunny-land/` (3,9 MB) | Tiles 16×16; zarigüeya 36×28, águila 40×41, rana 35×32 | **amanecer** / **selva** clara | Trae **mapa Tiled JSON** (`mapa-demo/maps/map.json`) y capas de parallax. Muy pulido. Se quitó la música (su licencia era distinta y exigía crédito). |
| Mapa + enemigos | GothicVania Cemetery | ansimuz | CC0 | `mapas/ansimuz-gothicvania-cemetery/` (4,9 MB) | Tiles 16×16; esqueleto 44×52, fantasma 37×65, hell-gato 96×53 | **noche** | **Mapa Tiled JSON** de 300×14 con capa de colisiones. El esqueleto que sale de la tumba (`skeleton-rise`) sirve para que aparezca una oleada. Paleta morada/azul oscura: le va bien un glow neón. Se quitaron los sonidos de la demo. |
| Mapa + enemigos | GothicVania Swamp | ansimuz | CC0 | `mapas/ansimuz-gothicvania-swamp/` (1,1 MB) | Tiles 16×16; araña 32×21, "thing" 33×45, fantasma 31×44 | **selva** (pantano) | Tileset, árboles y 3 capas de fondo. Selva oscura/húmeda. |
| Mapa + jefes | GothicVania Church | ansimuz | CC0 | `mapas/ansimuz-gothicvania-church/` (1,6 MB) | Tiles 16×16; ghoul en llamas 57×60, mago 81×66, ángel 122×117 | **tormenta** (catedral) | **Los tres sprites de personaje del pack ya están integrados.** El ángel es el jefe final de toda la campaña (etapa 5-3, `assets/enemigos/sheets/angel.png` — ver `tools/generar_angel_cc0.py` y `CREDITOS.md`): la sugerencia original de esta fila era emparejarlo con TORMENTA por tema (catedral/ángel oscuro), pero el jefe final de la campaña vive estructuralmente en el ÚLTIMO bioma del array `BIOMES` (DESIERTO DORADO), así que se usó ahí — moverlo a tormenta hubiera exigido reordenar los 5 biomas o duplicar lógica de `LEVELS` solo para esto. El **ghoul en llamas** (el enemigo de fuego que faltaba) se integró como enemigo normal en **TORMENTA ARCANA**, la que sí sugería esta fila (`assets/enemigos/sheets/ghoul_ardiente.png` — ver `tools/generar_ghoul_ardiente_cc0.py`). El **mago** ("wizard" en el pack) se miró de cerca para decidir si era mini-jefe candidato como decía esta fila: no lo es (sin fase 2, sin ataque telegrafiado, altura de dibujo igual al resto del bestiario normal, solo más ANCHO por la túnica), así que se integró como enemigo normal en **NOCHE** en vez de TORMENTA — TORMENTA ya tiene goblin_mage y el ghoul de arriba, hubiera quedado con 5 variantes mientras NOCHE se quedaba en 3 — con la clave `hechicero` (no `mago`, para no confundirse con goblin_mage; `assets/enemigos/sheets/hechicero.png` — ver `tools/generar_hechicero_cc0.py` y `CREDITOS.md`). |
| Mapa | GothicVania Rocky Pass | ansimuz | CC0 | `mapas/ansimuz-rocky-pass/` (190 KB) | Tiles 16×16; 3 capas de parallax 512×240 | **desierto** (cañón rojizo) | Es el mejor desierto pixel art CC0 que se encontró: roca roja con cristales y cielo rosado. Trae `.aseprite` fuente. No trae enemigos. |
| Mapa | Castle Platformer (twilight tiles) | Jetrel | CC0 | `mapas/jetrel-castle-twilight/` (85 KB) | Tiles 16×16 (hoja 256×256); 4 fondos parallax | **tormenta** / castillo nocturno | Estilo castlevania muy bonito (piedra y turquesa, luna). Pack chico y viejo (2009). El murciélago y la heroína Elisa son de referencia. |
| Enemigos | Goblin Corps (MV Platformer) | Moikmellah | CC0 | `enemigos/moikmellah-goblin-corps/` (1,4 MB) | Rejilla **32×64**, 10×4 | Todos los biomas (enemigo base de las oleadas) | **Lo más útil del lote**: goblins con idle, caminar, saltar, daño, KO, 3 tipos de golpe y guardia (lo que pide un brawler). Hay 10 variantes armadas (samurái, caballero, mago, lord…) y capas para combinar. Pixel art sobrio; son del mismo "mundo" que el duende. **Ya integrado**: `soldier` (enemigo "normal", `goblin_normal.png`), `samurai` (DESIERTO, `goblin_samurai.png`), `mage` (TORMENTA, `goblin_mage.png`), `peasant` (AMANECER, `goblin_peasant.png`), `assassin` (NOCHE, `goblin_assassin.png`), `centurion` y `battleLord` (SELVA, `goblin_centurion.png`/`goblin_battlelord.png`, piel canela y vincha = guerreros tribales de jungla), `guard` y `knight` (AMANECER, `goblin_guard.png`/`goblin_knight.png`, armadura gris genérica / con cresta roja — ver `tools/generar_goblin_variantes4_cc0.py`) — ver también `tools/generar_enemigos_cc0.py`, `tools/generar_goblin_variantes_cc0.py`, `tools/generar_goblin_variantes2_cc0.py` y `tools/generar_goblin_variantes3_cc0.py`. Queda 1 variante sin usar: `lord` (corona + capa/túnica larga sobre la misma armadura gris — se guarda para un bioma tipo castillo, ver CREDITOS.md: la corona lo lee como realeza y ningún bioma actual sostiene esa narrativa). |
| Enemigos | MV Platformer Skeleton | Moikmellah | CC0 | `enemigos/moikmellah-mv-skeleton/` (30 KB) | Rejilla **32×64**, 10×6 útiles | **noche**, **tormenta** | Mismo sistema de animación que los goblins (combate completo + KO), en versión normal y ensangrentada. |
| Enemigos | Sideview Fantasy Collection (sprites) | ansimuz | CC0 | `enemigos/ansimuz-sideview-fantasy/` (4,1 MB) | Varía: seta 63×37, rana 42×38, lagarto 64×32, serpiente ~27×20, fantasma 64×64, pájaro 32×32, conejo 34×44, dragón volador 192×176 | seta y rana → **selva/amanecer**; lagarto y serpiente → **desierto**; fantasma → **noche**; pájaro → cualquiera; conejo → **desierto** | La seta que escupe gas es un buen enemigo de área. **Trae FX de corte (slash horizontal, ascendente y circular)** que le quedan perfectos a la katana, además de explosión de muerte, fuego y electricidad (sirve para **tormenta**). El dragón volador sirve de mini-jefe (visto de cerca esta tanda: un único ciclo de vuelo sin ataque/daño/muerte propios, no lee como jefe ni vale la pena encogerlo a enemigo normal — se deja pendiente, ver CREDITOS.md). **Ya integrado**: `Grotto-escape-2-lizzard` (lagarto, DESIERTO, `assets/enemigos/sheets/lagarto.png`) — ver `tools/generar_lagarto_cc0.py` —, `Grotto-escape-2-snake` (serpiente, DESIERTO junto al lagarto, `assets/enemigos/sheets/serpiente.png`) — ver `tools/generar_serpiente_cc0.py` —, `sunny-froggy` (rana, SELVA, `assets/enemigos/sheets/rana.png`) — ver `tools/generar_rana_cc0.py` —, `enemy-ghost` (fantasma, NOCHE, `assets/enemigos/sheets/fantasma.png`) — ver `tools/generar_fantasma_cc0.py` —, `flying-bird` (pájaro, AMANECER, `assets/enemigos/sheets/pajaro.png`) — ver `tools/generar_pajaro_cc0.py` — y `sunny-bunny` (conejo, DESIERTO junto al lagarto/serpiente, `assets/enemigos/sheets/conejo.png`) — ver `tools/generar_conejo_cc0.py`. Ninguno de los seis trae frames de muerte propios: todos reusan el frame más extendido/distinto de su propio ciclo como pose de colapso (ver comentario en cada script). `sunny-mushroom` (seta caminante con casco rojo moteado) se miró de cerca y se descartó: es visualmente el mismo concepto que el `hongo` (Big Mushroom, Scratchio) ya integrado en SELVA — capuchón rojo con motas blancas sobre un cuerpo bulboso — y hubiera leído como el mismo enemigo repintado; ver CREDITOS.md. Solo el dragón sigue sin usar. |
| Enemigos | Big Mushroom | Scratchio | CC0 | `enemigos/scratchio-big-mushroom/` (46 KB) | 29×28 (ataque 40×18) | **selva**, **amanecer** | Animaciones completas: aparecer, caminar, daño, morir y esconderse. Incluye una versión invertida (sirve de variante élite) y la paleta. Muy pequeño: escalar x6. **Ya integrado en SELVA** (`hongo` en `SHEET_POR_BIOMA`, `js/engine.js`): se usaron caminar + daño + morir, re-empaquetadas en `assets/enemigos/sheets/hongo.png` por `tools/generar_hongo_cc0.py`. Aparecer/esconderse se dejaron fuera (el motor ya anima la aparición de todo enemigo por código) y quedan la paleta invertida y el ataque a distancia sin usar, por si se quiere una variante élite o un afijo "escupe esporas" a futuro. |
| Enemigos | 2D Platformer Enemies | Ashuuya | CC0 | `enemigos/ashuuya-platformer-enemies/` (30 KB) | murciélago 127×138, fantasma 75×138, esqueleto 138×138, slime 74×86, araña 138×138 | murciélago y araña → **noche**/**selva**; slime → **amanecer** | **Es el único a resolución parecida a la del juego**, pero es otro estilo (pintado, casi sin píxel visible) y solo trae el ciclo de movimiento, sin ataque ni muerte. Sirve de relleno o prototipo. |
| UI | 496 pixel art RPG icons | Henrique Lazarini (7Soul1) | CC0 | `ui/7soul1-496-rpg-icons/` (2,2 MB) | 34×34 aprox. | Tienda, cofres, inventario, skins | Espadas y katanas (`W_Sword*`), armaduras, pociones, gemas, pergaminos y skills. Estilo RPG clásico, más detallado que el resto. El recopilador quitó los iconos derivados de juegos con copyright. |
| Jefe | Hell Hound Sprite Animation | Luis Zuno (ansimuz) | CC0 | `enemigos/ansimuz-hell-hound/` (1,2 MB) | Rejilla propia por tira: idle/walk 64×32, run 67×32, jump 65×48 | **noche** (jefe) | Descargado el 2026-09-30 (fuera de la tanda del resto de esta tabla), aparte porque se buscó puntualmente para dar silueta propia a un SEGUNDO jefe de campaña (el primero fue el ángel de GothicVania Church, arriba). Sin `FRAMES.txt`; medido con PIL. **Ya integrado como el jefe de la etapa 1-3** (NOCHE VIOLETA, el PRIMER jefe de la campaña — al revés que el ángel, que es el ÚLTIMO): `hellhound` en `JEFES`/`SHEETS` (`js/engine.js`), `assets/enemigos/sheets/hellhound.png` — ver `tools/generar_hellhound_cc0.py` y `CREDITOS.md`. Reemplaza al `oso` reciclado solo en esa etapa; amanecer/selva/tormenta lo siguen usando. |

## Asignación sugerida por bioma

| Bioma | Tiles/fondo | Enemigos de oleada | Jefe |
|---|---|---|---|
| amanecer | Sunny Land (o Kenney) | goblins peasant/soldier, zarigüeya, rana, Big Mushroom | dragón volador (`sunny-dragon`) |
| desierto | Rocky Pass | goblins assassin/samurai, lagarto, serpiente | (sin candidato CC0 propio aún) |
| noche | GothicVania Cemetery | esqueletos (rise/walk), fantasmas, hell-gato, MV skeleton | sabueso infernal (Hell Hound, ansimuz) — **ya integrado**, ver más abajo |
| selva | GothicVania Swamp | araña, "thing", seta de gas, goblins | goblin battleLord (escalado) |
| tormenta | GothicVania Church + Castle twilight | ghoul en llamas, MV skeleton ensangrentado, goblin mage | mago (Church) |

Esta tabla es la sugerencia original (incluye mapas y jefes, aún sin
integrar). De los "enemigos de oleada" ya están en el juego: esqueleto
(noche), goblin samurai (desierto), goblin mage (tormenta), Big Mushroom
(selva), goblin peasant (amanecer), goblin assassin (noche, no desierto
como sugería esta tabla original — el traje azul-morado oscuro con capucha
se leyó mejor como "acecha de noche" que como ladrón del desierto, ver
CREDITOS.md), lagarto (desierto), serpiente (desierto, junto al lagarto,
como sugería esta tabla), goblin centurion/battleLord (selva, no estaban en
esta tabla original — piel canela y vincha se leyeron como guerreros
tribales de jungla en vez del "goblin battleLord escalado" que sugería la
tabla, ver CREDITOS.md), ghoul en llamas (tormenta, como sugería esta tabla,
clave `ghoul_ardiente`), mago (noche, no tormenta como sugería esta tabla
original — esa sugerencia era para cuando el mago era candidato a JEFE;
mirado a ojo no lee como jefe, ver CREDITOS.md, y como enemigo normal
tormenta ya tenía goblin_mage + el ghoul de arriba; clave `hechicero`, no
`mago`, para no confundirse con goblin_mage), goblin guard/knight (amanecer,
no estaban en esta tabla original — 2 de las 3 variantes "genéricas" de
armadura gris que sobraban del pack Goblin Corps, ver CREDITOS.md), rana
(selva, como sugería esta tabla), fantasma (noche, como sugería esta tabla),
pájaro (amanecer, esta tabla lo dejaba en "cualquiera" y se eligió amanecer
por ser el bioma con menos variedad y por la lectura directa "pájaros al
amanecer") y conejo (desierto, no estaba en esta tabla original — carpeta
`sunny-bunny` sin sugerencia de bioma, se eligió desierto por el nombre
"sunny" del pack y porque desierto se había quedado en 4 enemigos en vez de
5, junto a tormenta) — ver `SHEET_POR_BIOMA` en `js/engine.js`. De los jefes
por bioma, ya hay DOS con silueta propia (`JEFES` en `js/engine.js`): el
ángel oscuro (Church) es el jefe FINAL de la campaña (etapa 5-3, DESIERTO
DORADO estructuralmente por ser el último bioma del array `BIOMES`, no por
tema) y el sabueso infernal (Hell Hound, ansimuz, integrado esta misma
tanda) es el PRIMER jefe (etapa 1-3, NOCHE VIOLETA — no estaba en esta tabla
original, que sugería el ángel ahí por tema de catedral/cementerio; ver
CREDITOS.md). Amanecer, selva y tormenta siguen con el `oso` reciclado.
Zarigüeya, araña, "thing" y el dragón volador (visto de cerca, no lee como
jefe — ver CREDITOS.md) siguen pendientes. `lord` (Goblin Corps) y
`sunny-mushroom` (descartado por redundante con el hongo ya integrado, ver
CREDITOS.md) también quedan sin usar.
