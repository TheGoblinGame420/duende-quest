# Informe de la ronda de 263 agentes (25-26 oct 2026)

100 de contenido gratis y foros, 60 de ciberseguridad y 100 jugando como invitado (solo lectura), con una síntesis por equipo. Lo aplicado está en HISTORIAL-DUENDE.md (v298-v307).



---

# Duende Quest: informe del equipo de contenido

Este informe junta lo que encontraron los 100 agentes, sin duplicados. No se tocó ningún archivo, no se hizo ningún commit, no se descargó nada y no se entró al servidor de producción. Quedaron fuera los recursos con licencia dudosa o sin comprobar en su propia página. Tampoco entran los CC-BY-SA, porque obligan a publicar las versiones modificadas con la misma licencia.

## 1. Los 25 mejores recursos gratuitos para integrar ya

### Modelos 3D

| # | Recurso | URL | Licencia | Zona o uso | Por qué encaja con el low-poly colorido |
|---|---|---|---|---|---|
| 1 | Kenney Nature Kit (330 archivos) | https://kenney.nl/assets/nature-kit | CC0 1.0 | Bosque nocturno, Colinas Rojas, Cumbres, acantilados, pueblo y costa: árboles, rocas y follaje | Es del mismo autor que el kit de `assets/3d`. Se tiñe por material (terracota, lila, nieve, morado). Hay que confirmar que el zip trae GLB. |
| 2 | Quaternius Stylized Nature MegaKit (116 modelos) | https://quaternius.com/packs/stylizednaturemegakit.html | CC0 | Selva Esmeralda, islas flotantes del Abismo (rocas invertidas debajo) y paredes de las cavernas | Trae glTF, así que entra sin convertir con GLTFLoader de r160. El estilo es plano y se recolorea a verde, morado y dorado. |
| 3 | Kenney Castle Kit (75 piezas modulares) | https://kenney.nl/assets/castle-kit | CC0 1.0 | Castillo del Rey Goblin y fortalezas de asedio Luz/Sombra en el Abismo (muros, torres, puertas, armas de asedio, banderas) | Mismo autor y estilo que el kit actual. Cada facción se distingue por el tinte del material. |
| 4 | Kenney Fantasy Town Kit 2.0 (160 archivos) | https://kenney.nl/assets/fantasy-town-kit | CC0 1.0 | Casas, plaza y puestos del pueblo de los duendes | Misma familia Kenney, con la paleta morada y dorada. |
| 5 | Kenney Pirate Kit | https://kenney.nl/assets/pirate-kit | CC0 | Costa marina: muelle, barcas, palmeras y ruinas costeras | Mismo autor y estilo. Se recolorea a turquesa y morado. |
| 6 | Quaternius Market Stalls (con Kenney Food Kit https://kenney.nl/assets/food-kit, también CC0) | https://poly.pizza/m/PUZZ5F91OE | CC0 (ambos) | Mercado andino del pueblo: puestos de chicha, canastas y mazorcas | Flat-shaded y en glTF. Toldos morados y amarillos con patrón de aguayo. |
| 7 | Corn (Quaternius) | https://poly.pizza/m/IhhB7kGaAQ | CC0 | Campos y nodos de recolección del Maíz Morado Sagrado | Low-poly plano. Se recolorea a morado con un material sin textura. |
| 8 | Quaternius Ultimate Monsters (50 animados) | https://quaternius.com/packs/ultimatemonsters.html | CC0 | Mobs de las 10 zonas. Jefes escalados x3-x4 con emisivo morado | glTF animado, colores vivos, mismo lenguaje visual que Kenney. |
| 9 | Dragon Evolved (Quaternius) | https://poly.pizza/m/LlwD0QNUPj | CC0 | Montura voladora o jefe del Abismo, dorado para Luz y morado oscuro para Sombra | glTF animado. Una sola malla sirve para las dos facciones. |
| 10 | KayKit Skeletons (Kay Lousberg) | https://kaylousberg.itch.io/kaykit-skeletons | CC0 1.0 (no revender sin modificar) | Enemigos de mazmorras, cavernas y la cueva repetible | glTF riggeado y animado. Estilo chunky y limpio, compatible con Kenney. |
| 11 | Quaternius Universal Animation Library (+120 clips) | https://quaternius.com/packs/universalanimationlibrary.html | CC0 | Animaciones de duendes y NPC: caminar, correr, atacar, lanzar hechizos, morir y emotes | GLB directo con AnimationMixer. Para móvil basta cargar 6-8 clips. |
| 12 | Big Crystal (Quaternius) | https://poly.pizza/m/pf5lzmgr2J | CC0 | Cavernas abisales, islas del Abismo y restos del Cántaro roto | Facetado low-poly. Con emisivo morado o dorado y algún PointLight queda muy vistoso a bajo coste. |
| 13 | Pine Tree with Snow + Rock Snow (Quaternius) | https://poly.pizza/m/17vQv2X5rh y https://poly.pizza/m/eZRzCg5BcR | CC0 | Cumbres Nevadas | Un solo autor da coherencia. Se pueden instanciar con InstancedMesh. |

### Efectos visuales e interfaz

| # | Recurso | URL | Licencia | Zona o uso | Por qué encaja |
|---|---|---|---|---|---|
| 14 | Kenney Particle Pack (80 sprites) | https://kenney.nl/assets/particle-pack | CC0 | Habilidades, chispas, niebla de Picos de Tormenta, destellos de rayo y vapor del Cántaro | Un atlas en gris que se tiñe por facción con blending aditivo, en un solo material. |
| 15 | Kenney Smoke Particles (70 sprites) | https://kenney.nl/assets/smoke-particles | CC0 1.0 | Nubes en billboard bajo las islas flotantes y estela de vuelo | Mucho más barato que nubes volumétricas en Telegram y móvil. Se tiñen de lila o dorado. |
| 16 | Kenney Fantasy UI Borders (140 archivos) | https://kenney.nl/assets/fantasy-ui-borders | CC0 1.0 | Ventanas del HUD, diálogos de NPC, inventario y tienda (border-image de 9 cortes) | Estética de fantasía. Se lleva a morado y dorado con hue-rotate. |

### Audio

| # | Recurso | URL | Licencia | Zona o uso | Por qué encaja |
|---|---|---|---|---|---|
| 17 | Edge of the forest at night (felix.blume) | https://freesound.org/people/felix.blume/sounds/645637/ | CC0 | Bucle base del bosque nocturno (recortar a menos de 60 s y pasar a OGG de 96-128 kbps) | Insectos y sapos que dan un ambiente vivo y mágico. |
| 18 | Loopable Dungeon Ambience (JaggedStone) | https://opengameart.org/content/loopable-dungeon-ambience | CC0 | Castillo goblin, cavernas abisales e islas de Sombra | Ya viene en OGG y en bucle (1,6 MB), sin melodía que choque con la música. |
| 19 | Wind whoosh loop (SketchMan3) | https://opengameart.org/content/wind-whoosh-loop | CC0 | Viento en altura del Abismo, bordes de acantilado y planeo con alas | OGG de 252 KB en bucle. Se usa como PositionalAudio cerca del vacío. |
| 20 | Large Wings Flap (AntumDeluge) | https://opengameart.org/content/large-wings-flap | CC0 | Sonido al desplegar las alas o aletear | Refuerza el vuelo, que es el sello de AION. |
| 21 | andean loop (luis_audp) + Charango_improv3 (Bmangelo) | https://freesound.org/people/luis_audp/sounds/196357/ y https://freesound.org/people/Bmangelo/sounds/466491/ | CC0 (ambos, comprobado en su página) | Taberna de chicha, plaza, menús y santuario del Maíz Morado | Quena, charango y bombo: identidad peruana auténtica. |
| 22 | Town Theme RPG (cynicmusic) | https://opengameart.org/content/town-theme-rpg | CC0 (crédito opcional) | Tema del pueblo en ORIGINS y del pueblo inicial en CLASSIC | Arpa y flautas: fantasía tranquila que combina con lo andino. |
| 23 | JRPG Epic Rock Battle Theme #1 (HydroGene) | https://opengameart.org/content/jrpg-epic-rock-battle-theme-1 | CC0 | Jefes de zona y asedios del Abismo (la intro suena una vez y luego el bucle) | Intro y bucle separados, listos para pasar de exploración a combate. |
| 24 | 80 CC0 RPG SFX (rubberduck) | https://opengameart.org/content/80-cc0-rpg-sfx | CC0 | Hechizos, monedas, gemas, cofres de encargos, daño y muerte de mobs | Cubre recompensas y habilidades. Con playbackRate se hace agudo para Luz y grave para Sombra. |
| 25 | Kenney Interface Sounds (100 archivos) | https://kenney.nl/assets/interface-sounds | CC0 1.0 | Clics del HUD, abrir y cerrar paneles | Misma marca que el kit 3D. Hay que precargar solo 10-15 sonidos cortos. |

**Notas de integración comunes:**
- Los packs que no traen glTF (Quaternius Ultimate Nature y similares) se convierten una vez a GLB en Blender y se comprimen con gltf-transform (meshopt).
- En los modelos se recolorea el material y no se cargan texturas.
- Rocas, árboles, maíz y cristales van con InstancedMesh.
- El audio se pasa a OGG mono de 64-96 kbps, más un MP3 de respaldo para Safari. Se carga solo al entrar en cada zona y empieza después del primer toque del jugador.
- Para el cielo de cada zona conviene un degradado hecho con shader (0 KB) y una FogExp2 del mismo color que el horizonte. Los HDRI CC0 de Poly Haven se reservan para `scene.environment` a 1K, solo en escritorio.
- Hay que llevar un CREDITS con el autor, la URL y la licencia de cada recurso, aunque sea CC0.

**Descartados por licencia dudosa o restrictiva:**
- LOWPO Goblin: dice CC0 pero prohíbe redistribuir.
- Precious Gems: su licencia "CC1" no existe.
- Oasis Pack y Amir Horses: licencias propias que no son estándar.
- Paletas de Lospec, Resurrect 64 incluida: no tienen licencia formal.
- Recursos marcados "CC0 según el buscador" sin comprobar en su página: Telos Desert, Desert Loop, Wind (IgnasD), Winter Tree, Mall Santa y otros.
- Recursos CC-BY-SA, por la obligación de compartir igual: skiingpenguins, Gull sounds y Spell Sounds de p0ss.
- Código de Tuts+ y del repositorio Agent-Skills: el segundo mezcla material GPL.
- Mixkit, Uppbeat y ElevenLabs: no son CC0.

## 2. Las 15 conclusiones de foros más accionables

1. **El vuelo tiene que ser lo principal.** En AION el contenido importante ocurre en el aire. Conviene poner cofres, hitos y jefes en islas a las que solo se llega volando, con corrientes de viento que recarguen el tiempo de vuelo. Fuente: https://mein-mmo.de/en/aion-2-hoffnungsschimmer-mit-verbesserungspotential,1553232
2. **Tienda solo de cosméticos.** AION 2 tuvo que retirar los potenciadores y las mejoras de equipo que vendía por dinero real tras las protestas. Fuente: https://www.koreajoongangdaily.com/business/aion-2s-launch-marred-by-pay-to-win-k-pop-idol-likeness-misuse-allegations/11591069
3. **No bloquear el comercio ni la subasta detrás de un pago o una suscripción.** Fue una de las críticas principales a AION 2. Fuente: https://mein-mmo.de/aion-2-abo-bezahlmodell-aenderungen/
4. **Los consumibles de pago no deben revenderse por oro, y el pase debe dar cosméticos o comodidad, no poder.** Así se evita el caso Tiger Candy de AION Classic. Fuente: https://mein-mmo.de/aion-startet-classic-server-werden-nun-stark-kritisiert/
5. **Equilibrar antes de añadir nada.** La queja más votada en r/aionclassic es que las clases desequilibradas hundieron el juego. Durante la beta: ninguna clase nueva, y medir las victorias PvP de cada clase. Fuente: https://reddit.sudovanilla.org/r/aionclassic/top
6. **Sesiones de 1 a 3 minutos que valgan la pena**, con diarias, semanales y eventos de temporada para frenar el desgaste de la novedad. Fuente: https://hackernoon.com/the-challenge-of-sustaining-mini-game-momentum-on-telegram
7. **Viralidad dentro del chat de Telegram** (enlace de referido, clasificación que se comparte en el grupo, premio por invitar) **y medir la retención D1/D7 con una meta de más del 20%.** Lo habitual en Telegram es entre 5 y 20%. Fuente: https://www.theblock.co/post/339563/telegram-games-had-trouble-earning-revenue-retaining-users-in-q4-report
8. **Destacar el juego en tiempo real (grupo, jefe compartido) en la primera sesión del invitado.** Es la ventaja frente a los juegos de "tocar para ganar". Fuente: https://mobileecosystemforum.com/telegrams-gaming-ambitions/
9. **Primer logro en menos de 1 minuto**, por ejemplo el primer mob o el primer Maíz Morado. Así el jugador siente dominio y propósito pronto. Fuente: https://odr.chalmers.se/items/208425d7-7e28-4386-88a7-56edbd4ab554
10. **Quitar la confusión antes que añadir contenido.** Un solo objetivo visible a la vez y un HUD mínimo al principio. Fuente: https://yukaichou.com/gamification-study/4-experience-phases-gamification-2-onboarding-phase/
11. **Medir el tutorial como un embudo**: aparecer, moverse, primer combate, primera misión, volver al día siguiente. Así se ve dónde abandonan los 10 jugadores de la beta. Fuente: https://create.roblox.com/docs/production/game-design/onboarding
12. **Contar el lore con el entorno y no con muros de texto.** Fragmentos del Cántaro y campos quemados a la vista, y que cada zona tenga un solo arco con su jefe guardando un pedazo. Esto refuerza lo que ya se hizo en la v301. Fuentes: https://www.gamedeveloper.com/design/environmental-storytelling y https://www.engadget.com/2014-04-16-the-world-as-a-story-emergent-storytelling-in-world-of-warcraft.html
13. **El bono para la facción con menos jugadores debe dar solo recompensas** (XP, oro, puntos de Abismo) **y nunca estadísticas de combate.** Si sube el poder, hay quien espera a ir perdiendo para arrasar. Además, el bono por población baja y el bono por marcador bajo no deben sumarse. Fuentes: https://forums.swtor.com/topic/640933-suggestion-how-to-encourage-skill-balance-between-factions y https://forums.elderscrollsonline.com/en/discussion/comment/4197705/
14. **Asedios con poca gente:**
    - Los guardias y muros escalan según los atacantes conectados.
    - Los defensores NPC cuestan mantenimiento (chicha o maíz) y aguantan un tiempo limitado.
    - Los huecos vacíos se rellenan con mercenarios NPC más débiles que un jugador.
    - Un 5v5 semanal en una ventana programada.
    - Sin topes duros de población.

    Fuentes: https://forums.elderscrollsonline.com/en/discussion/comment/938964, https://forum.battlemaster.org/index.php/topic,6636.0.html, https://gamedev.net/forums/topic/719778-phantom-worlds-reimagining-the-sandbox-mmorpg/ y https://www.engadget.com/2009-01-10-counterpoint-on-warhammer-onlines-fortress-siege-population-cap.html
15. **Concentrar a los 10 jugadores en un pueblo central y dejar el chat global visible por defecto.** La sensación de servidor vivo viene del chat público, no del número de jugadores. Un mundo grande con poca gente se siente vacío. Fuentes: https://seforums.pantheonmmo.com/content/forums/topic/2098/how-big-does-a-community-need-to-be/view/page/2 y https://forum.square-enix.com/ffxiv/showthread.php?p=6210275

---

# Informe de seguridad de Duende Quest: 25 hallazgos únicos

**Cómo se hizo:** reuní los 60 informes, junté los repetidos (por ejemplo, reportar aparecía 4 veces, entregarPedido 4, los scripts sin SRI 6 y los pedidos $DUENDE 2) y comprobé los más graves contra el código actual del disco, que tiene cambios sin commitear en `functions/mmo/world.js`, `mundo/js/mundo.js` e `inicio/index.html`. La entrada JSON llegó cortada al final, así que puede faltar el último informe.

**Quitados porque ya están arreglados en el disco:**
- Error de sintaxis en `inicio/index.html:185`.
- Canal de chat desconocido que se saltaba el bloqueo de invitados (`social.js:237` ya tiene lista blanca).
- Planear desde el suelo para cruzar el vacío (`mundo3d.js:671`, `s.planeoAlto`).
- Doble entrega en entregarPedido (`world.js:1147`, cerrojo `pd.entregando`).
- Spam de `titulo` (`world.js:1652`).
- MOTD de hermandad sin filtro antiestafa (`hermandades.js:256`).
- Fuerza bruta de vincUsar: ya tiene límite de fallos, pero queda un fallo relacionado (punto 17).

**Marcados con ⚠️ PAGOS:** tocan la verificación de pagos o los precios. Necesitan el visto bueno del dueño antes de cambiar nada.

---

## ALTA

### 1. ⚠️ PAGOS: un solo pago on-chain cierra varias órdenes de skin, y verify responde `success` aunque no se guarde la compra
**`functions/api/helius-verify.js:168`** (búsqueda en l.98-109, INSERT en l.181)
- **Explotación:** `create_sol_order` no pide autenticación. El atacante crea N órdenes y manda una sola transacción que lleva las N referencias y una transferencia igual al precio de la skin más cara. Cada verify encuentra esa misma transacción y marca su orden como `filled`. Si el índice UNIQUE `skin_purchases_txsig_uniq` no existe (depende del orden en que se ejecutaron los SQL), se desbloquean todas las skins. Si existe, el INSERT falla en silencio y aun así se responde `{success:true}`.
- **Arreglo:** antes del PATCH, rechazar firmas que ya estén en `sol_orders` (`sol_orders?tx_signature=eq.<sig>` → 409). Comprobar que el INSERT devolvió una fila. Crear `CREATE UNIQUE INDEX IF NOT EXISTS sol_orders_txsig_uniq ON sol_orders(tx_signature) WHERE tx_signature <> ''`. Exigir que la transacción tenga una sola referencia de orden.

### 2. Torneo semanal ganado sin jugar, y DQ canjeable sin jugar
**`functions/api/wallet.js:425`** (Telegram) y **`:565`** (web_redeem)
- **Explotación (torneo):** el único control es el tiempo transcurrido. Con un ticket de `start_game` se esperan unas 2,8 h y se envía `wave=500, score=5000000`. Pasa el control, se guarda con `verified:true` y `cron.js:114-130` le paga el premio en $DUENDE cada semana.
- **Explotación (web):** con `web_start_run`, 48 min de espera y `wave=145, coins=1500` se cobra el tope de DQ. Además, varios tickets pedidos de golpe se cobran todos (`accrue_dq_web` solo exige que el ticket sea más nuevo que el último). Escala con cuentas de Supabase gratuitas.
- **Arreglo:**
  - Tope de puntos por segundo: `score <= 300*seg + 30000`.
  - Latido del cliente cada 60 s guardado en una tabla `run_state`, y exigir `wave <= últimaOleadaLatido + 2`.
  - Gastar el ticket de forma atómica: `used_runs` con `UNIQUE(telegram_id, run_ts)`, o `p_run_ts` dentro de la RPC `accrue_dq` con `FOR UPDATE`.
  - En la web, guardar `dq_last_submit_ms` y rechazar los tickets emitidos antes del último cobro.
  - Para `web_redeem`, exigir `email_confirmed_at` y una antigüedad mínima de la cuenta.
  - Revisar a mano el top 3 antes de que el cron pague.

### 3. El código de rescate es el token de sesión permanente, y la herencia de invitado a cuenta es silenciosa (robo de personaje en PC compartido o por estafa)
**`functions/mmo/world.js:444`** y **`:492-509`**; **`mundo/js/mundo.js:1158`** y **`:3361`**
- **Explotación:**
  - En una cabina, la siguiente persona entra sola con el duende anterior, porque `dq_mmo_tok` vive en localStorage sin caducidad y sin botón de salir.
  - Si esa persona inicia sesión en web o Telegram, el cliente manda `inv` sin preguntar y el servidor mueve el personaje a su cuenta y borra `c:inv:…`.
  - Con la estafa «pásame tu código», el atacante entra, expulsa a la víctima y se queda el personaje en su cuenta. El token no se puede rotar ni revocar.
- **Arreglo:**
  - Mandar `inv` solo si existe la marca `sessionStorage.dq_heredar`, puesta desde un botón explícito «Pasar mi duende de invitado a esta cuenta», y que el servidor exija `m.heredar === true`.
  - Añadir «Salir de este dispositivo» para invitados.
  - Que canjear un código pida `m.rotar` y el servidor emita un token nuevo (`tokNuevo`), invalidando el anterior.
  - Ocultar el código tras un botón «Mostrar».

### 4. El baneo de un invitado no funciona, y la herencia limpia el baneo
**`functions/mmo/dios.js:229`** y **`functions/mmo/world.js:492`**
- **Explotación:** `mod.ban` va por uid, y el uid sale de un token que genera el cliente. El baneado borra localStorage y vuelve a entrar al momento. También puede crear una cuenta web o entrar con Telegram, enviar su token antiguo y heredar el mismo personaje con un uid limpio, sin baneo ni silencio. En `functions/mmo/` no existe `banIp`.
- **Arreglo:**
  - En `banear`, si el objetivo es `inv:`, guardar `mod.banIp[ip] = ahora + min(horas,24)h` y comprobarlo en `hola()` en la rama `inv`.
  - En `holaCuenta`, antes de heredar: `if (await this.baneado(uidInv)) return this.expulsar(...)`.
  - Trasladar `mod.mute[uidInv]` al uid nuevo.

### 5. Nombres reservados y de otros jugadores imitables con homoglifos
**`functions/mmo/dios.js:34`** (`claveNombre`) y **`mmo/js/data.js:1862`** (`limpiarNombre`)
- **Explotación:** `EIDuende` (con I mayúscula), `ElÐuende`, `Adm1n`, `M0derador` y `S0porte` pasan el filtro RESERVADO. Con `LaIo` se imita a `Lalo`, que se ve igual en la fuente del chat. Sirve para estafas haciéndose pasar por el equipo. Las hermandades tienen el mismo fallo.
- **Arreglo:** quitar de `limpiarNombre` las letras `ÐðØøÞþßæÆ×`. Crear un `esqueleto()` que convierta `0→o, 1/i→l, 3→e, 4→a, 5→s, rn→m, vv→w` y usarlo tanto para RESERVADO como para la clave de unicidad `n:`. Durante la transición, comprobar también la clave antigua. Revalidar el nombre en cada entrada que no sea de un dios (`world.js:542`).

### 6. Scripts de terceros sin SRI, TON Connect con versión flotante y CSP sin `script-src`
**`mmo/js/client.js:2940`**, **`game.html:51`**, **`telegram/index.html:801`** (`@tonconnect/ui@2`); **`index.html:2220`** (`@solana/web3.js@1.99.0` sin integrity); supabase-js en 5 páginas; importmap de three en **`mundo/index.html:16`**; **`worker.js:59`**
- **Explotación:** jsDelivr sirve la última versión 2.x publicada en npm. Si se publica una versión maliciosa, se ejecuta en el origen del juego: puede cambiar el destino de las transacciones TON o Phantom y leer los tokens de Supabase y `dq_mmo_tok`. Ya hubo casos reales así: connect-kit en 2023 y web3.js 1.95.6 en 2024. Sin `script-src` no hay una segunda barrera.
- **Arreglo:**
  - Fijar `@tonconnect/ui@2.0.9` con `integrity="sha384-…" crossorigin="anonymous"`.
  - En `index.html`, usar la misma web3.js 1.98.0 que ya lleva SRI en `client.js:3143`.
  - Añadir SRI a supabase y la clave `integrity` al importmap. Mejor aún, copiar las librerías a `/vendor/`.
  - Empezar con `Content-Security-Policy-Report-Only` con `script-src` limitado a rutas con versión.

---

## MEDIA

### 7. ⚠️ PAGOS: los pedidos en $DUENDE pueden repetir monto y un atacante se queda con el pago ajeno
**`functions/mmo/world.js:922`**
- **Explotación:** a diferencia de SOL (`ocupado`, l.934), el monto `raw` no se reserva. La verificación no mira quién paga, y los pedidos vencidos valen 24 h. Con unos 240 pedidos vivos por cuenta, cada pago ajeno coincide con uno de ellos con un 2,4 % de probabilidad. El atacante pega la firma de la víctima antes que ella y recibe el paquete.
- **Arreglo:**
  ```js
  const ocupadoD = r => this.pedidos.some(x => x.metodo === 'duende' && x.duendeRaw === r && x.estado !== 'entregado' && x.estado !== 'anulado');
  ```
  Reintentar hasta 30 veces y responder «tienda ocupada» si no hay monto libre. Limitar a 5 los pedidos vencidos por cuenta.

### 8. ⚠️ PAGOS: un pedido vencido conserva su precio 24 h
**`functions/mmo/world.js:~960`** (`pedidoFirma`) y **`~1069/1085`** (`verificarSol` / `verificarDuende`)
- **Explotación:** se crea un pedido caro, se espera a que baje $DUENDE o SOL y se paga el monto antiguo.
- **Arreglo:** `if (!tx.tiempo || tx.tiempo > desde + PEDIDO_VIGENCIA_MS + 120000) return {ok:false,...}`. La firma puede llegar tarde; el pago no.

### 9. ⚠️ PAGOS: el precio de $DUENDE sale de un precio al contado manipulable
**`functions/api/lib.js:103`** (lo usan `wallet.js:159`, `:202`, `:265` y la factura de Stars)
- **Explotación:** se baja el precio en el pool, se hace `ton_buy` (recibe el doble de créditos) y se recompra. También al revés para `ton_sell`. `pairs[0]` de DexScreener puede ser un par sin liquidez.
- **Arreglo:** pedir las dos fuentes y exigir que difieran menos de un 10 %. Elegir el par con más liquidez (mínimo 5000 USD). Rechazar si el precio varía más de ±15 % respecto al último bueno guardado en KV. Usar el mayor para compras y el menor para ventas.

### 10. Vuelo infinito alternando a=4 y a=3
**`functions/mmo/mundo3d.js:231`** (subida) y **`:237`** (energía)
- **Explotación:** se planea (a=4) un segundo y después se manda un mensaje a=3 con `h = h0 + 7`. El servidor lo acepta porque dtS≈1. A los 10 ms se vuelve a a=4, así que solo se cobran 0,01 s de energía. Resultado: vuelo sin límite con las alas de aprendiz, se cruza el Abismo entero y se queda por encima de los 8 m, donde los monstruos no atacan.
- **Arreglo:**
  ```js
  if (a === 3) h = clamp(hq, h0 - 7.5*dtS - 0.5, h0 + (prevA === 3 ? 6.5*dtS : 0) + 0.5);
  if (prevA === 3 || a === 3) s.vueloS += dtS;
  ```
  Y recargar el presupuesto de distancia con el modo más lento de los dos (`prevA` y `a`).

### 11. Velocidad 1,4x a pie y en el pueblo fingiendo planeo
**`functions/mmo/mundo3d.js:227-232`** y presupuesto en **`~241`**
- **Explotación:** se alterna `{a:0,h:2}` con varios `{a:4,h:2}`. El presupuesto de distancia se calcula con `modo=1.4` sin montura, sin nivel 20 y sin alas. La regla de vacío ya está arreglada, pero el modo de velocidad no.
- **Arreglo:** `if (a === 4 && prevA !== 3 && prevA !== 4 && h0 <= 2.5) a = 0;` y usar el modo 1.4 solo con `s.planeoAlto`.

### 12. Inundar el Telegram del dueño con /reportar, y phishing en el motivo
**`functions/mmo/social.js:292-300`**
- **Explotación:** el límite ya es por uid, pero un invitado nuevo es un uid nuevo y gratis. Sigue sin haber límite por IP ni tope global. Con avisos 429 de Telegram, `avisarAdmin` se traga los errores y se pierden los avisos de pagos y retiros. El motivo no pasa por `riesgoEstafa`, así que se pueden colar URLs y comandos `/entregar` o `/pagado` clicables en el chat del bot del dueño.
- **Arreglo:**
  - Invitados de nivel menor que 5 no reportan.
  - Límite por IP (`'i:'+s.ip`).
  - Tope global de 10 avisos cada 10 min; el resto solo se guarda.
  - `if (riesgoEstafa(motivo)) return this.no(...)`, neutralizar `/`, `@` y `.` en el aviso, y enviarlo sin `parse_mode` y con `link_preview_options:{is_disabled:true}`.

### 13. Premio completo de invasión, élite raro o jefe por un solo golpe o una cura, calculado con el nivel de la zona
**`functions/mmo/eventos3d.js:177`** y **`:200`**; **`functions/mmo/mundo3d.js:371`**
- **Explotación:**
  - Un nivel 1 que toca a un invasor en una zona 40-50 recibe unos 9.900 XP (sube a nivel 12-13) más un objeto de nivel 40.
  - El suelo de 1/3 del premio de jefe vale para cualquier entrada en `o.dano`.
  - Sirve para subir cuentas secundarias a nivel 15 (chicha, mTON) o a nivel 60 (chicha física).
- **Arreglo:**
  - Aporte mínimo para entrar en `ev.part`: `o.max*0.05` en invasiones y `0.03` en raros.
  - `nv = Math.min(clamp(...), c.nivel + 3)`.
  - Exigir presencia en la zona al pagar.
  - En jefes, aplicar el suelo de 1/3 solo si `parteJusta >= 0.1`.

### 14. Cuentas web sin correo confirmado cuentan como reales para mTON (TON real), premios de invitar a amigos y referidos
**`functions/mmo/world.js:736`** (`elegibilidad`) y **`functions/mmo/amigos.js:35-50`**, **`:72`**
- **Explotación:** se registran cuentas web por script sin captcha y sin tope por IP. Además, la herencia conserva `c.creado`, así que un invitado subido a nivel 15 por un bot ya cumple las 48 h. Cada cuenta cobra el 20 % del fondo diario de mTON. Con un `?ref=` se llena la lista de amigos de la víctima y se le mandan mensajes por el bot.
- **Arreglo:**
  - Guardar `c.emailOk = s.extraAuth.emailOk` (hoy se calcula y no se usa) y exigir `tg: || emailOk || vinc.tg` en `elegibilidad` y en `anotarInvitacion`.
  - Guardar `creadoCuenta` en la herencia y contar la edad desde ahí.
  - Tope diario de mTON por IP.
  - Activar «Confirm email» y Turnstile en Supabase.

### 15. ⚠️ PAGOS: el bono de referido de Telegram se paga por un simple /start, y el tope de 20 se rompe en paralelo
**`functions/api/telegram-bot.js:172`** y **`:274-283`**
- **Explotación:** 20 cuentas desechables mandan `/start ref_X` y el atacante gana 10.000 $DUENDE retirables con `ton_sell`. Se puede encadenar con las mismas cuentas. Comprobar y luego insertar no es atómico. Además, el invitado nunca recibe sus 500, porque `add_duende_by_tgid` necesita un perfil que aún no existe.
- **Arreglo:** guardar el referido como `status:'pending'` y pagarlo en el cron cuando el invitado tenga `games_played >= 5` y más de 3 días, con el cerrojo PATCH `pending→paid`. La RPC `registrar_referido` debe usar `pg_advisory_xact_lock`.

### 16. Bloqueo de cuevas, mazmorras y Torre llenando los topes globales
**`functions/mmo/cueva3d.js:44`**, **`functions/mmo/mazmorras.js:75`**, **`functions/mmo/torre.js:30`**
- **Explotación:** con unas 5 IPs, 40 invitados se meten cada uno en su cueva y se quedan quietos; las cuevas ocupadas nunca se desalojan. En la Torre, 3 cuentas que entran y salen en bucle llenan las 30 instancias.
- **Arreglo:** tope de 2 cuevas por IP, desalojar las instancias sin actividad durante más de 10 min (`actT`), nivel mínimo 5 para que un invitado abra una cueva, liberar las torres vacías antes del tope y cerrar las mazmorras con más de 2 h.

### 17. Vinculación de cuentas: código con Math.random, sin confirmación del dueño y con tope global que bloquea a todos
**`functions/mmo/vincular.js:49`** y **`:58-60`**
- **Explotación:**
  - Ingeniería social con «dame tu código y te regalo una skin»: el dueño no confirma nada.
  - El tope nuevo de 60 fallos en todo el servidor permite que un atacante con 12 cuentas deje la vinculación bloqueada para todos.
  - Con un código de un duende de nivel mayor que 5, `vincConfirmar` dice si se acertó (oráculo).
- **Arreglo:** usar `crypto.getRandomValues` con 8 caracteres. Límite por IP en lugar del global. Exigir que la cuenta A acepte (`vincPedir` / `vincAceptar`) estando conectada.

### 18. El nombre de los personajes de Telegram es el @usuario o el nombre real y se reparte a todo el servidor
**`functions/mmo/world.js:436`**; **`functions/api/wallet.js:432`** (ranking del arcade y torneo)
- **Explotación:** cualquier invitado ve el @handle y puede escribir por privado con el gancho de «soporte» a jugadores con wallets. `'Duende'+id.slice(-4)` filtra cifras del ID de Telegram, y `duende_<tgId>` lo filtra entero.
- **Arreglo:** usar `limpiarNombre(m.nombre) || 'Duende'+rand4` y, en el arcade, el alias de `profiles`. Ofrecer un renombrado gratis a quien tenga como nombre su @username.

### 19. Desconectarse en el Abismo evita la muerte PvP, la pérdida de PA y la caída al vacío
**`functions/mmo/world.js:~264`** (`cerrar`)
- **Explotación:** cuando va perdiendo, el jugador cierra la pestaña; al volver aparece fuera del Abismo. Los duelos sí castigan el abandono.
- **Arreglo:** guardar `t.ultPvP = {de, t}` al recibir golpes PvP. En `cerrar()`, si estaba en el Abismo y recibió un golpe PvP hace menos de 10 s o estaba sobre el vacío sin alas, llamar a `morir` y a `muertePvP`.

### 20. Combate 2D y duelos: el cliente elige el paso del combo, y las victorias de duelo se farmean
**`functions/mmo/combate.js:265`** y **`:263`**; **`functions/mmo/duelos.js:147`**
- **Explotación:**
  - Mandar siempre `{t:'atk',s:2}` da x1,45 de daño y alcance 85, y el margen de recarga al 0,8 da un 25 % más de golpes por segundo.
  - Con una pestaña de invitado se acepta un duelo y se cierra a los 4 s: diez veces dan el logro Duelista (3000 de oro).
  - Un tercero puede curar a un duelista en pleno duelo.
- **Arreglo:** llevar el combo en el servidor (`s.pasoAtk` con una ventana de tiempo) y usar una recarga `cd - 60` sin acumular ventaja. Sumar `duelosG` solo si `puntuarDuelo` da Elo (sin `inv:`, nivel 10 o más). Excluir de curas y escudos a quien esté en un duelo ajeno.

### 21. `create_sol_order` y `check_nfts` sin autenticación ni límite, y las skins pagadas con SOL no llegan al juego
**`functions/api/helius-verify.js:137`** y **`:180`**
- **Explotación:** un bucle agota CoinGecko (precio null, todos los compradores reciben 503) y la cuota de Helius (los pagos reales quedan en `payment_not_found`). Además, `sol_orders` no guarda quién compra, así que la compra queda como `wallet_XXXX` y el MMO no la encuentra: el jugador pierde lo que pagó.
- **Arreglo:** caché de 60 s para el precio de SOL. Límite por `CF-Connecting-IP` y regla de WAF. Exigir `init_data` o `access_token` en `create_sol_order` y guardar `telegram_id` y `user_id` (`ALTER TABLE sol_orders ADD COLUMN ...`).

### 22. Ranking público falsificable con cualquier nombre
**`js/auth-manager.js:333`** y **`sql/02-seguridad.sql:387`**
- **Explotación:** desde la consola, `supabase.from('game_scores').insert({user_id, username:'ElDuendeOficial', score:5000000})` sale primero en la portada. Además, el trigger pasa ese score a `best_score` del perfil.
- **Arreglo:** añadir `.eq('verified', true)` en `auth-manager.js:335` y en `telegram/index.html:1596`. Quitar `username` del GRANT INSERT y poner un trigger que lo tome de `profiles`. Más adelante, borrar la política `scores_insert_propio`.

### 23. Scripts SQL que, si se vuelven a ejecutar, regalan saldo o reabren permisos
**`sql/redeemable-balance.sql:21`** y **`sql/01-blindaje.sql:33`**
- **Explotación:**
  - Volver a ejecutar `redeemable-balance.sql` convierte `dq_coins`, que escribe el cliente, en saldo canjeable, y deja `accrue_dq` y `redeem_dq` sin las protecciones reforzadas.
  - Volver a ejecutar `01-blindaje.sql` da otra vez UPDATE sobre `is_premium` y `equipped_skin`.
  - Aparte, `redeem_dq_web` acepta `p_dq` negativo.
- **Arreglo:** dejar `redeemable-balance.sql` con un `RAISE EXCEPTION` de obsoleto. Quitar esas dos columnas del GRANT en `01-blindaje.sql`. Ampliar `guard_profile_money` a `is_premium`, `equipped_skin`, `dq_earn_*`, `dq_last_run_ts` y `wallet_ton_actualizado`. Añadir `IF p_dq <= 0 THEN RETURN -1` y un `CHECK (dq_redeemable >= 0)`.

### 24. Carrera en respuestaHerm: estar en dos hermandades a la vez y bloquear nombres
**`functions/mmo/hermandades.js:139`** (y **`:172`** al disolver)
- **Explotación:** mandar `hermCrear` y `hermResp{si:1}` seguidos. Queda un líder huérfano en A, cuyo nombre se reserva para siempre. Aceptar justo mientras se disuelve una hermandad la resucita sin nombre reservado, lo que permite nombres duplicados.
- **Arreglo:** usar `s.fundando` como cerrojo y volver a comprobar `s.cerrado || s.c.herm` después del await. Al disolver, poner `h.disuelta = true` y quitarla de `this.herms` antes de cualquier await. Deduplicar la carga con `hermsP`.

---

## BAJA (y de impacto real)

### 25. Puntos pequeños agrupados
- **`functions/api/telegram-bot.js:467`:** el nombre del top sin `mdSeguro` rompe `/admin` con un solo `_`, por ejemplo `juan_perez`, y permite meter un enlace. **Arreglo:** `mdSeguro(topToday[0].username)` y un reintento sin Markdown si falla.
- **`functions/mmo/world.js:68`:** los tokens de los bots de prueba son triviales (`'8'.repeat(32)`), así que cualquiera entra como «Probador» o lo hereda. **Arreglo:** rechazar `/^(.)\1{31}$/` y no heredar uids que estén en `UIDS_PRUEBA`.
- **`functions/api/lib.js:232`:** ⚠️ PAGOS. El 0,99 se suma al 0,95 de quien llama, así que una skin TON se paga al 94 %. **Arreglo:** dejar un solo margen.
- **`.assetsignore:9`:** no excluye `.dev.vars`, `.env` ni `secrets.js`. Wrangler publica todo el disco, así que un `.dev.vars` local quedaría público con la service key y el token del bot. **Arreglo:** añadirlos a `.assetsignore` y, más adelante, publicar desde `public/`.
- **`functions/mmo/social.js:251`:** el chat de grupo no respeta /ignorar. **Arreglo:** añadir `if (!meIgnora(x, s.c.uid))` al recorrer los miembros.

---

# Duende Quest ORIGINS: los 30 cambios de mayor impacto según 100 agentes

Ordené los cambios por impacto y esfuerzo: primero los errores (1–25), después claridad y diversión (26–30). Las líneas son las que dieron los agentes. No las comprobé en el código, así que conviene confirmarlas antes de editar porque el árbol tiene cambios sin commitear. Esfuerzo: **S** = menos de 10 líneas, **M** = varias funciones o cliente más servidor.

## A. Errores

### 1. La recarga automática corta a los jugadores con cada commit (S). Hacerla primero, antes de commitear en vivo.
**mundo/js/mundo.js:2211**
- **Problema:** El `setInterval` hace `location.reload()` cuando `!hayVentana()`. `hayVentana` no tiene en cuenta los paneles laterales (tienda, NPC, mochila, diario o leyenda, pase) ni el chat abierto. Con un commit tras cada cambio y 10 jugadores, cada publicación recarga a todos: se pierde el mensaje a medio escribir, la compra o la leyenda, y se repiten unos 15 s de carga.
- **Arreglo:** Añadir a la condición `!document.querySelector('.modal.on') && !chatAbierto() && !($('chat-in').value||'').trim() && performance.now()-entradaT > 120000 && performance.now()-toqueT > 20000`. Declarar `let entradaT=0, toqueT=0`, poner `entradaT=performance.now()` en `'bienvenido'` y actualizar `toqueT` con listeners `pointerdown` y `keydown` en fase de captura. Opcional: un aviso con botón «Actualizar ahora» y recarga forzada como mucho a los 10 min.

### 2. La leyenda y la recompensa diaria se pisan en `#v-diario` (S)
**mundo/js/mundo.js:2229** (también 2215, 2236, 2467, 2481)
- **Problema:** `#v-diario` es un panel lateral, así que `hayVentana()` no lo ve. Tras elegir clase, `mostrarDiario` (a los 900 ms) y `leyendaPrimeraVez` (cada 3 s) se sobrescriben. Puede pasar que la leyenda se pierda para toda la sesión, porque `sessionStorage` ya la marcó como vista, o que el temporizador de 12 s del diario la cierre a mitad de lectura. `avisoInvitado` tiene el mismo choque.
- **Arreglo:** En `leyendaPrimeraVez` y `avisoInvitado`, reintentar si `hayVentana() || $('v-diario').classList.contains('on') || loginPend3`. Al inicio de `verLeyenda`/`avisoInvitado`, poner `clearTimeout(mostrarDiario.t)`. En `mostrarDiario`, si `v-diario` está abierto, reprogramarlo a los 2 s. Orden resultante: clase → premio → leyenda.

### 3. Telegram a pantalla completa suma `--tg-top` dos veces (S)
**mundo/index.html:103, 310, 317** y **mundo/js/mundo.js:1638**
- **Problema:** El bucle COMPACTO coloca misiones, chat, grupo, alas y objp con `top = marco.offsetTop+…`, que ya incluye el margen. Después, la regla `tgfs` les vuelve a sumar `margin-top`. `#obj` y `#botones` también lo llevan dentro de su `top`. En iPhone o Android a pantalla completa (unos 100 px), las misiones caen sobre el joystick y quedan recortadas a 28 px sin poder tocarse, y el botón ⋯ choca con VOLAR.
- **Arreglo:** Quitar `#obj` y `#botones` de la regla de la línea 103 y añadir `body.tgfs.movil #alas,…#objp,#grupo3,#misiones,#chat{margin-top:0}`. Otra opción: en la línea 1638, `e.style.top=(y-parseFloat(getComputedStyle(e).marginTop||0))+'px'`. De paso, añadir `body.tgfs #chicha3` a la regla de `margin-bottom` de la línea 104, porque la píldora tapa la barra de habilidades.

### 4. ATACAR en el móvil se activa y desactiva sin que se vea (S)
**mundo/js/mundo.js:2776, 1787** e **index.html:242**
- **Problema:** `#acc-atk`, el único indicador de `autoAtk`, está oculto en el móvil. `#t-atk` alterna el estado, así que dos toques lo apagan sin aviso y parece que el combate falla.
- **Arreglo:** En `pintarBarra`: `if (MOVIL){const b=$('t-atk'); b.classList.toggle('on',autoAtk); b.textContent=autoAtk?'PARAR':'ATACAR';}` más el CSS `#tactil button.on{background:rgba(220,38,38,.9);box-shadow:0 0 12px #f87171}`. Opcional: ignorar un segundo toque antes de 700 ms si ya está activo.

### 5. El paso 4 del tutorial en el móvil señala una habilidad bloqueada y el tutorial se atasca (S)
**mundo/js/mundo.js:3099**
- **Problema:** Como `#acc-atk` está oculto, el «segundo botón de la barra» es la habilidad de nivel 4. `usarHab` sale antes de `tuto3.hab=true`.
- **Arreglo:** Cambiar el texto a `MOVIL ? 'el primer botón de la barra ('+habsDe(yo.clase)[0].nombre+')' : 'tecla 2'`. Hacer que el botón lata con `.acc.pista` mientras `tuto3.i===3`.

### 6. La caja de misiones del móvil (50 px) esconde la misión, la flecha y la entrega (M)
**mundo/js/mundo.js:3159, 3164, 3111** e **index.html:311**
- **Problema:** El tutorial va primero y ocupa los 50 px. La fila 📜 con progreso, metros y «¡Lista!» queda oculta. Una invasión se coloca delante del tutorial y lo empuja fuera. Hacen falta dos toques para entregar.
- **Arreglo:** Calcular `const tt=htmlTuto3()` y anteponerlo al final (después del bloque de invasión). Acortar los textos MOVIL de TUTO3 a 35 caracteres como máximo, con la flecha y los metros dentro del paso 2. Añadir la clase `con-tuto` con `max-height:74px` mientras haya tutorial.

### 7. El primer hechizo con lanzamiento (Bola de Fuego, Castigo) se cancela solo (S)
**mundo/js/mundo.js:2662** (también 2818 y 1396)
- **Problema:** `usarHab` activa `autoAtk` y el auto-avance camina si la distancia supera 17,25 m antes de que llegue `'cast'`. Con el ping de Telegram el jugador se mueve 1–2 m y el servidor cancela con «Te moviste» (mundo3d.js:263). Le pasa al mago y al sacerdote justo a su distancia natural.
- **Arreglo:** En `usarHab`, si `h.cast`: `lanzando={id:h.id,ini:ahora,fin:ahora+h.cast+400,prov:true}; P.vx=P.vz=0;`. En `'no'`/`'habNo'`, limpiar `lanzando` si es provisional (`prov`).

### 8. `ataqueAuto` dispara durante un lanzamiento y gasta el Sigilo (S)
**mundo/js/mundo.js:2922**
- **Problema:** Durante el lanzamiento salen disparos de vara fantasma (sonido y destello sin daño), y el servidor los descarta. El pícaro en Sigilo gasta su ×2 y +2 de combo en un golpe básico.
- **Arreglo:** Al principio de la función: `if (lanzando) return; if (P.au && (P.au.sigilo||0) > performance.now()) return;`.

### 9. Polimorfia se rompe al instante (S)
**mundo/js/mundo.js:2662** (y 1404)
- **Problema:** `autoAtk` sigue activo y la vara golpea a la oveja.
- **Arreglo:** Tras `hab3`: `if (h.id==='polimorfia'){autoAtk=false; colaHab=null; pintarBarra();}`. En `'hb'` propio de polimorfia, ejecutar `cicloObjetivo()` y avisar «🐑 Oveja: no la golpees».

### 10. El guerrero no gana Ira con su ataque en 3D (S, servidor)
**functions/mmo/mundo3d.js:294** (y `atacarDuelo3d` hacia la línea 315)
- **Problema:** Es la clase «★ Recomendada». Empieza con 0 de Ira, el Golpe Heroico queda gris y «Gana Ira al pegar» no se cumple.
- **Arreglo:** Tras `const real=r[1], crit=…`: `if (CLASES[s.c.clase]?.recurso==='ira' && real>0) s.rec=Math.min(100,s.rec+8+(crit?3:0));`. Lo mismo en duelo.

### 11. `usarHab` no valida en el cliente y bloquea la barra 1 s (S)
**mundo/js/mundo.js:2652–2661**
- **Problema:** Sin recurso, con Eviscerar sin combos o fuera de alcance, envía igual, pone el GCD y activa `autoAtk`. Además `tuto3.hab=true` se marca aunque el servidor rechace.
- **Arreglo:** Antes de enviar:
  - si `P.rec < costoHab(...)`, mostrar «Te falta Ira (x/15): pega o recibe golpes»;
  - si es Eviscerar sin combo, «usa Golpe Siniestro»;
  - si el objetivo cuerpo a cuerpo está lejos, «Acércate».

  Mover `tuto3.hab=true` a `efectoHab` cuando `m.p===miId`.

### 12. Las curas del sacerdote van a un aliado «fantasma» (S)
**mundo/js/mundo.js:2659, 2593, 1893** e **index.html:366**
- **Problema:** `objetivoP` solo se borra con Escape, que no existe en el móvil. Elegir un monstruo no lo limpia. Resultado: no puede curarse a sí mismo («Tu aliado está demasiado lejos») ni resucitar al caído que tiene al lado.
- **Arreglo:**
  - en `elegirMon`, poner `objetivoP=0`;
  - en `usarHab`, mandar `tp:0` si el aliado no existe, está muerto, está fuera de rango o es un rival;
  - añadir un botón ✕ en `#objp`;
  - mostrar en un aviso «Sanar → Tú/Nombre».

### 13. Se puede curar, escudar o resucitar a la facción enemiga y al rival de duelo (S, servidor)
**functions/mmo/mundo3d.js:1174, 1183, 1269**
- **Arreglo:** Crear un helper `amigo3d(s,a)` que excluya al rival de duelo y a la otra facción en el Abismo. Aplicarlo en `aliado3d`, `aliadosCerca3d` (Rezo) y `finCast3d`.

### 14. Repetir Dolor o Renovar reinicia el tick y nunca hace efecto (S, servidor)
**functions/mmo/mundo3d.js:1366, 1373** y **combate.js:541, 548**
- **Arreglo:** Conservar `prox` si el aura sigue activa: `const prev=obj.au.dolor; const prox=prev&&prev.hasta>ahora?prev.prox:ahora+3000;`.

### 15. Eviscerar desde Sigilo deja 2 combos gratis (S, servidor)
**functions/mmo/mundo3d.js:1378** y **combate.js:557**
- **Arreglo:** `const cp=s.combo||0; g(pegar(obj,h.mult+h.porCombo*cp)); s.combo=0; ev.cp=cp;`, es decir, poner el combo a cero después del golpe.

### 16. El mago con Dagas duplica su DPS y la Odachi lo baja (S, servidor)
**functions/mmo/mundo3d.js:297, 319**
- **Problema:** La vara usa la cadencia del arma pero no su `dano`.
- **Arreglo:** `vara ? VARA.mult*(arma.dano||1) : 3.6*(arma.dano||1)`.

### 17. ORIGINS asigna tareas imposibles: «Recoge una expedición» y «10 pisos de Torre» (M, servidor)
**functions/mmo/tareas.js:35, 38** y **mmo/js/data.js:1340, 1352**
- **Problema:** Bloquean el bono del día y el de la semana. Las semanales no se pueden cambiar.
- **Arreglo:** Marcarlas con `soloClassic:true` (o `d2`) y filtrarlas en `elegir()` cuando `s.m3`. Reemplazar las que ya estén asignadas sin cumplir. Aprovechar para decidir las tareas de `grupo` y `mundial` por nivel y no por el número de conectados (líneas 45–48).

### 18. Con el chat enfocado y el teclado cerrado, el duende se congela (S)
**mundo/js/mundo.js:2737, 2776–2787**
- **Problema:** En Android, el botón Atrás cierra el teclado pero el input conserva el foco. `preventDefault` en el joystick y los botones impide quitarlo.
- **Arreglo:** Crear `soltarChat()` (blur y ocultar si está vacío) y llamarla al inicio del `touchstart` de `#joy` y de cada botón de `#tactil`.

### 19. El joystick y SUBIR se quedan pegados al salir de Telegram o con un segundo dedo (S)
**mundo/js/mundo.js:2555, 2737, 2079**
- **Arreglo:** Crear `soltarControles()` que reinicie `joy`, `tocandoSubir`/`tocandoBajar`, la base y el pomo. Llamarla en `blur`, en `TG 'deactivated'` y en `visibilitychange` cuando `hidden`. En el `touchstart` de `#joy`, hacer `return` si `joy.id!==null`.

### 20. El Capitán de una invasión cumple el encargo «Derrota al jefe de zona» (S, servidor)
**functions/mmo/encargos.js:20–24**
- **Arreglo:** `if (tipo==='jefe' && (!o || o.k!==MAPAS[zona]?.jefe)) continue;`. Calcular la zona con el objeto (`o.zona` o `zonaEn(o.x,o.z)`) y pasar `n` o `cf` desde recoger y cofre (mundo3d.js:893, eventos3d.js:247).

### 21. Carga en el Abismo puede dejar al jugador sobre el vacío y matarlo (S, servidor)
**functions/mmo/mundo3d.js:1317**
- **Arreglo:** Si está en el Abismo y `!islaEn(cx,cz)`, buscar un punto con k entre 1,6 y 0,4 que sí tenga isla. Si no lo hay, rechazar con «No puedes cargar sobre el vacío».

### 22. Quien muere peleando contra el jefe de misión pierde el crédito (S, servidor)
**functions/mmo/mundo3d.js:359**
- **Arreglo:** Antes del `continue` para los muertos: si `o.jefe` y su daño es al menos el 10 % del total, avanzar solo su misión (sin XP ni botín).

### 23. Al cambiar de mes (19:00 en Perú) los premios del pase sin cobrar desaparecen (S, servidor)
**functions/mmo/retencion.js:199** y **pase.js:21**
- **Arreglo:** Llamar a `cobrarPasePendiente(s)` en el aviso de día nuevo y al inicio de `puntoPase` y `cobrarPase` si existe `c.pasePend`. Evita que `pasePend` se sobrescriba.

### 24. El punto rojo de ⋯ no se enciende nunca y en el móvil no se ven los premios del pase (S, una línea)
**mundo/js/mundo.js:2495**
- **Arreglo:** En `marcaPase()`: `$('b-mas')?.classList.toggle('aviso',k>0)`. Cambiar también el toast de pase.js:60 a «Cobra tu premio en 🎟 (en móvil, dentro de ⋯)».

### 25. El editor de apariencia nunca se abre solo, y el botón Atrás de Telegram deja la cámara bloqueada (S)
**mundo/js/mundo.js:1263, 2371, 1959**
- **Problema:** `!antes` nunca se cumple porque `'bienvenido'` ya rellena `yo` (es código muerto). Si se abre a mano y se cierra con Atrás, `camAntes` no se restaura y la cámara se queda a 4,6 m de frente.
- **Arreglo:** Cambiar la condición a `antes && !antes.clase && yo.clase && !yo.look` y esperar a que el diario o la leyenda estén libres. En `cerrar(id)`, si `id==='v-look' && camAntes`, restaurar la cámara, poner `lookEditor=null` y llamar a `cambiarSkinPropia()`.

## B. Claridad y diversión

### 26. La bienvenida «sigue la luz amarilla» se pierde detrás del selector de clase (S)
**mundo/js/mundo.js:1242, 1845, 1967**
- **Arreglo:**
  - En `'bienvenido'`, poner `bienvenidaPend=true`. En `'yo'`, cuando la clase pasa de vacía a definida, lanzar el aviso a los 400 ms.
  - En `aviso()`, hacer la duración proporcional al texto: `Math.min(12000, Math.max(4500, txt.length*60))`.
  - Al elegir clase, desactivar los botones y mostrar «Eligiendo…». Si el WebSocket no está abierto, avisar «Conectando…».

### 27. Entrega automática: tutorial, Guardia y siguiente misión (M)
**mundo/js/mundo.js:3101, 1987** y **functions/mmo/world.js:2005, 2045, 1980**
- **Problema:** El paso 6 pide «entrégala tocando su fila», pero en 3D la misión se entrega sola. No se anuncia la siguiente misión y los toasts se pierden (máximo 4). La Caza del día dice «cóbrala con el Guardia Tito».
- **Arreglo:**
  - Paso 6: «Completa tu misión 📜 (p/n): se entrega sola».
  - Mandar un solo toast: «✅ «X» cumplida +XP +oro · 📜 Siguiente: «Y», caza N × Z en Zona».
  - Para `s.m3`, cambiar el texto a «Toca ¡Lista! en tu panel».
  - Añadir `sfx`/`vib` al recibir «✅».

### 28. Las misiones semanales y los premios de las tareas no se muestran (S)
**mundo/js/mundo.js:3188–3190, 3232**
- **Arreglo:**
  - Pintar `T.sem.l` (texto y p/n) y `T.premio`/`T.premioSem`, con la cuenta atrás hasta las 00:00 UTC.
  - Hacer que el «¿Seguro?» del botón 🔄 lo pinte `pintarMisiones` a partir de `cambioPend`, para que no se borre en cada repintado.

### 29. La cámara del móvil en vertical: FOV de unos 30° y sin seguimiento (S)
**mundo/js/mundo.js:3276, 313, 2860**
- **Arreglo:**
  - Calcular `fovBase=camara.aspect<0.8?74:60` en `ajustar()` y usarlo en `fovObj`.
  - Seguimiento automático en el móvil cuando no se arrastra la cámara: `camYaw=lerpAng(camYaw,P.ry+Math.PI,1-Math.exp(-dt*kf))`, solo al avanzar o en la caminata automática.
  - Guardar el zoom en `localStorage` con `try/catch`.

### 30. Jefes de misión sin aviso de nivel y mensaje falso de reaparición (S)
**mundo/js/mundo.js:3142, 3197**
- **Problema:** El Sabueso Nv 8 llega cuando el jugador va por Nv 5 y no sale aviso, porque el umbral de jefe es 5 niveles. El mensaje «aparecen en unos segundos» es falso para jefes, que tardan hasta 5 min.
- **Arreglo:** Para jefes, bajar el umbral a `mq.nivel-yo.nivel>=2` con el texto «Jefe: ve en grupo o sube a Nv X». Si `metaMision.jefe`, mostrar «alguien lo derrotó, reaparece en menos de 5 min; mientras, haz encargos 🧭».

## Pendientes menores (siguiente tanda)

| Cambio | Ubicación |
|---|---|
| Tocar un monstruo en el móvil = atacar | 2772: `elegirEn(...,true)` |
| Aviso cuando ATACAR o FIJAR no encuentran monstruos | 2618 |
| El doble SALTO en el pueblo no debe intentar volar | 2688 |
| Habilidades cuerpo a cuerpo más débiles que el golpe automático en 3D | mundo3d.js:1328, factor ×1,6–2,4 |
| Torbellino y Nova sin enemigos no deben gastar recurso | mundo3d.js:1233 |
| El lore del primer hito no se muestra | 1281, bandera `encListo` |
| Encargo de vuelo: quitar «(V)», mostrar la altura y revisar sin la espera de 1 s | encargos3d.js:43, encargos.js:53 |
| Dirección para los encargos de cofre y jefe | 3154 |
| `enableClosingConfirmation` en Telegram | 50 |
| Minimapa ilegible a 84 px | 2121 |
| `#obj` tapa el marco propio | index.html:310 |
| Feedback visible al completar un paso del tutorial | 3109 |
| Icono de vara para el mago | 1762 |
| Sigilo visible en 3D | 1406 |