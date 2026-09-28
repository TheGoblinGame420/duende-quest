# Recursos de arte de terceros (sin integrar)

Descargados el 2026-09-28. **Todo es CC0 (dominio público)**: uso comercial permitido y sin atribución obligatoria. Cada carpeta tiene su `LICENCIA.txt` (fuente, autor, URL de la licencia) y, si trae sprites animados, un `FRAMES.txt` con el tamaño de frame y las animaciones para cortarlos.

Total aproximado: **21 MB, 14 packs**.

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
| Mapa + jefes | GothicVania Church | ansimuz | CC0 | `mapas/ansimuz-gothicvania-church/` (1,6 MB) | Tiles 16×16; ghoul en llamas 57×60, mago 81×66, ángel 122×117 | **tormenta** (catedral) | Trae el **ghoul en llamas** (el enemigo de fuego que faltaba), un **mago** que sirve de mini-jefe y un **ángel oscuro** que sirve de jefe. Ver `FRAMES.txt`. |
| Mapa | GothicVania Rocky Pass | ansimuz | CC0 | `mapas/ansimuz-rocky-pass/` (190 KB) | Tiles 16×16; 3 capas de parallax 512×240 | **desierto** (cañón rojizo) | Es el mejor desierto pixel art CC0 que se encontró: roca roja con cristales y cielo rosado. Trae `.aseprite` fuente. No trae enemigos. |
| Mapa | Castle Platformer (twilight tiles) | Jetrel | CC0 | `mapas/jetrel-castle-twilight/` (85 KB) | Tiles 16×16 (hoja 256×256); 4 fondos parallax | **tormenta** / castillo nocturno | Estilo castlevania muy bonito (piedra y turquesa, luna). Pack chico y viejo (2009). El murciélago y la heroína Elisa son de referencia. |
| Enemigos | Goblin Corps (MV Platformer) | Moikmellah | CC0 | `enemigos/moikmellah-goblin-corps/` (1,4 MB) | Rejilla **32×64**, 10×4 | Todos los biomas (enemigo base de las oleadas) | **Lo más útil del lote**: goblins con idle, caminar, saltar, daño, KO, 3 tipos de golpe y guardia (lo que pide un brawler). Hay 10 variantes armadas (samurái, caballero, mago, lord…) y capas para combinar. Pixel art sobrio; son del mismo "mundo" que el duende. |
| Enemigos | MV Platformer Skeleton | Moikmellah | CC0 | `enemigos/moikmellah-mv-skeleton/` (30 KB) | Rejilla **32×64**, 10×6 útiles | **noche**, **tormenta** | Mismo sistema de animación que los goblins (combate completo + KO), en versión normal y ensangrentada. |
| Enemigos | Sideview Fantasy Collection (sprites) | ansimuz | CC0 | `enemigos/ansimuz-sideview-fantasy/` (4,1 MB) | Varía: seta 63×37, rana 42×38, lagarto 64×32, serpiente ~27×20, fantasma 64×64, pájaro 32×32, dragón volador 192×176 | seta y rana → **selva/amanecer**; lagarto y serpiente → **desierto**; fantasma → **noche**; pájaro → cualquiera | La seta que escupe gas es un buen enemigo de área. **Trae FX de corte (slash horizontal, ascendente y circular)** que le quedan perfectos a la katana, además de explosión de muerte, fuego y electricidad (sirve para **tormenta**). El dragón volador sirve de mini-jefe. |
| Enemigos | Big Mushroom | Scratchio | CC0 | `enemigos/scratchio-big-mushroom/` (46 KB) | 29×28 (ataque 40×18) | **selva**, **amanecer** | Animaciones completas: aparecer, caminar, daño, morir y esconderse. Incluye una versión invertida (sirve de variante élite) y la paleta. Muy pequeño: escalar x6. |
| Enemigos | 2D Platformer Enemies | Ashuuya | CC0 | `enemigos/ashuuya-platformer-enemies/` (30 KB) | murciélago 127×138, fantasma 75×138, esqueleto 138×138, slime 74×86, araña 138×138 | murciélago y araña → **noche**/**selva**; slime → **amanecer** | **Es el único a resolución parecida a la del juego**, pero es otro estilo (pintado, casi sin píxel visible) y solo trae el ciclo de movimiento, sin ataque ni muerte. Sirve de relleno o prototipo. |
| Jefe | Grotto Escape 2 Boss Dragon | ansimuz | CC0 (ver nota) | `jefes/ansimuz-grotto-dragon/` (490 KB) | **144×64** | **desierto** o **tormenta** | Idle (6), aliento de fuego (7) y coletazo (8). Viene con un `patreon-license.txt` antiguo que lo limita a mecenas, pero el autor lo publicó explícitamente como CC0 en OGA dentro de esta colección. Detalles en `LICENCIA.txt`. |
| UI | 496 pixel art RPG icons | Henrique Lazarini (7Soul1) | CC0 | `ui/7soul1-496-rpg-icons/` (2,2 MB) | 34×34 aprox. | Tienda, cofres, inventario, skins | Espadas y katanas (`W_Sword*`), armaduras, pociones, gemas, pergaminos y skills. Estilo RPG clásico, más detallado que el resto. El recopilador quitó los iconos derivados de juegos con copyright. |

## Asignación sugerida por bioma

| Bioma | Tiles/fondo | Enemigos de oleada | Jefe |
|---|---|---|---|
| amanecer | Sunny Land (o Kenney) | goblins peasant/soldier, zarigüeya, rana, Big Mushroom | dragón volador (`sunny-dragon`) |
| desierto | Rocky Pass | goblins assassin/samurai, lagarto, serpiente | Boss Dragon |
| noche | GothicVania Cemetery | esqueletos (rise/walk), fantasmas, hell-gato, MV skeleton | ángel oscuro (Church) |
| selva | GothicVania Swamp | araña, "thing", seta de gas, goblins | goblin battleLord (escalado) |
| tormenta | GothicVania Church + Castle twilight | ghoul en llamas, MV skeleton ensangrentado, goblin mage | mago (Church) |
