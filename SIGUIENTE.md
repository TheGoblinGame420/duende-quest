# Traspaso — estado del juego (28-sep-2026)

Documento para retomar el trabajo en otra conversación. Todo lo de aquí está
medido o probado, no son ideas sueltas.

---

## ⚠️ ANTES DE HACER `git push` — orden de despliegue

Hay cambios de seguridad en el servidor (`functions/api/`) y en la base de
datos (`sql/02-seguridad.sql`). El orden importa:

1. **Supabase → SQL Editor:** ejecutar el **PASO A** de `sql/02-seguridad.sql`
   (bloques A1-A4). Se puede hacer ya: no rompe el cliente publicado.
2. **`git push`** (despliega Worker + juego).
3. **Supabase:** descomentar y ejecutar el **PASO B** del mismo archivo. Cierra
   la lectura pública de saldos, wallets y compras. Hacerlo antes del push
   rompería la Mini App vieja.
4. **Cloudflare → Security → WAF → Rate limiting:** una regla para `/api/*`
   (p. ej. 30 peticiones/min por IP). No se puede hacer desde el código.

**Aviso de transición:** con el código nuevo, un pago TON debe llevar en sus
6 últimos dígitos (nanotons) el "resto" que el servidor da a cada usuario. Si
alguien está a mitad de un pago justo durante el despliegue, su pago no se
reconocerá solo: habría que acreditarlo a mano. Con 2 usuarios, basta con
avisarles.

---

## Qué se hizo el 28-sep-2026

### Juego
- **Campaña de 15 etapas** (5 biomas × 3). La 3.ª de cada bioma es un jefe.
  3 estrellas por etapa: completar · terminar con ≥50% de vida sin revivir ·
  recoger 3 sellos ✦ de las plataformas. DQ solo por estrellas **nuevas**
  (no se puede farmear). Mapa de niveles con candados. SIN FIN se desbloquea
  al vencer la 1-3 y es el único modo que va al ranking.
- **Jefes con ataques telegrafiados** (45-60 frames de aviso rojo en el
  suelo): embestida, salto sísmico con ondas (encima de una plataforma no te
  tocan: primera razón real para subir), lluvia de rocas con hueco garantizado,
  y embestida doble. Fase 2 de furia al 50%. Aturdido tras cada ataque (daño
  x1,5). Cada bioma tiene un repertorio distinto (`ESTILO_JEFE`).
- **4 armas que cambian el juego** (antes `weaponBuff` no hacía nada):
  KATANA, ODACHI (lenta, enorme alcance), CHISPA (el daño salta a otro
  enemigo), DAGAS (rapidísimas, doble combo). Duran hasta coger otra.
- **Slam**: aterriza en plataformas, pega el doble si saltas desde altura y ya
  no golpea a los voladores. Golpe aéreo +25%.
- **Efectos de corte CC0** (3 cortes de combo, muerte, descarga) en
  `assets/fx/`, generados con `tools/generar_fx.py`.
- **Skins de pago animadas** por código (antes el que pagaba veía un
  personaje congelado y el gratis uno animado).
- Bugs corregidos: matar con balas/rayo no daba XP ni contaba jefes; el
  descanso borraba al jefe; jefe al azar (12%) que no era evento; COMBOS de la
  pantalla final siempre 0; oleada del bioma siguiente mal calculada;
  **cuadrado de color detrás de todos los enemigos teñidos** (bug de
  `tintedSprite`); `shadowBlur` sustituido por halos cacheados.
- Misiones imposibles (wave8) cambiadas por metas de campaña; 4 logros de
  campaña nuevos.

### Seguridad (auditoría completa; ver informe en la conversación)
- **Secuestro de perfiles desde el bot:** `/start` movía a tu Telegram el
  perfil de quien tuviera tu `first_name`. Eliminado.
- **Reclamar pagos TON ajenos:** el servidor aceptaba el primer pago reciente
  a la wallet dev. Ahora cada pago lleva un resto HMAC por usuario.
- **Doble acreditación por carrera** (TON y Stars): ahora el INSERT único se
  hace antes de acreditar.
- **Score falso:** ticket de partida firmado por el servidor; se rechazan
  oleadas/puntos imposibles para el tiempo jugado y la reutilización.
- **Skins gratis** escribiendo en localStorage o en `update_profile`: ahora se
  valida la compra (servidor y cliente).
- **Pago SOL ajeno** atribuible a otro usuario: ahora la compra es siempre de
  la wallet que pagó.
- Precios de respaldo fijos en operaciones con dinero → ahora 503.
- Referidos farmeables, Markdown inyectable en /ranking y Discord, ruta de
  Helius sin validar, error 500 en rutas inexistentes (`binding` de assets),
  cabeceras de seguridad (`_headers`).
- **El torneo semanal no pagaba a nadie** (bug anterior a esta sesión):
  `verified` tiene `DEFAULT false` y Postgres lo aplica antes del trigger, así
  que ningún score salía verificado. El Worker ahora envía `verified: true`.
- La landing anunciaba **staking de SOL con 120-240% APY**: sección oculta
  (reversible, ver comentario en `index.html`), igual que la línea del bot.
- Pruebas locales en `dist-test/` (no se versiona): `test-ton.mjs`,
  `test-worker.mjs`, `test-ticket.mjs`, `test-ton-buy.mjs` (5 peticiones
  simultáneas con un pago → solo una acredita).

### Revisión independiente
Un agente revisor auditó todo el diff y encontró 13 problemas, corregidos:
revivir durante un jefe atascaba la etapa; el score tras revivir no llegaba
al ranking de Telegram; morir en la celebración tras vencer al jefe daba
GAME OVER; SQL frágil (firma de `link_telegram`, política `FOR ALL`); un
segundo pago TON quedaba tapado por el primero; ranking local mezclado.

Al ejecutar el PASO A, **mira los avisos (WARNING)** del SQL Editor: si dice
que `game_scores` tiene una política `FOR ALL`, hay que cambiarla a mano.

---

## Cómo medir el juego (funciona muy bien)

Conducir el juego desde la consola con un jugador automático: `startGame({nivel:i})`
o `startGame()` (sin fin) y luego `update()` en bucle. **`requestAnimationFrame`
no corre con el panel oculto**: sustituirlo por `() => 0` y llamar `update()` a mano.
El bot debe reaccionar a `jefe.estado === 'aviso'` según `jefe.ataque`.

Perfiles: novato `{reaccion:26, precision:.55, agresividad:.5}`, casual
`{18, .72, .6}`, bueno `{13, .85, .75}`.

Medido el 28-sep (el bot nunca usa pociones ni items, así que es pesimista):
- 1-1: casual gana 4/4; novato gana ~50% llegando a 59 s de media.
- 1-3 (jefe): bueno 3/4, casual y novato ~25%, muchas derrotas con el jefe
  al 5-15% de vida (buen gancho para reintentar). Pelea de 18-35 s.
- Etapas 2-3 a 5-3: dificultad creciente; el bueno pierde algunas del bioma 4-5.

---

## Segunda tanda (misma noche, 28-sep-2026) — Mini App y landing rotas

El usuario avisó: "en la mini app no puedo ver mi perfil, no aparecen las
skins ni el ranking, no se puede comprar ni conectar la wallet TON". Todo
tenía código funcionando por debajo — el problema era la interfaz:

- **La raíz de la página no fijaba tamaño de fuente.** Todo el menú usaba
  `rem` pensando en una raíz grande, pero heredaba los 16px por defecto del
  navegador: los botones (SKINS SHOP, TON WALLET, EXCHANGE, etc.) medían
  4-6px, básicamente invisibles. Ahora `telegram/index.html` fija
  `html{font-size:26px}`.
- **No existía pantalla de perfil.** `showProfile()` solo abría un `alert()`.
- **TON Connect probablemente no conectaba en producción**: el manifiesto
  apuntaba a un icono `coin.png` que no es 180×180 (spec de TON Connect), sin
  cabecera CORS (las wallets externas lo leen desde el navegador), la
  librería se cargaba desde `unpkg` (menos fiable que `jsdelivr`), y sin
  `twaReturnUrl` no había forma de volver a la Mini App tras aprobar en la
  wallet. Los cuatro corregidos.
- Sustituido el menú de 10 botones en columna por **5 pestañas**: JUGAR,
  PERFIL (nuevo — nivel, stats, skin equipada, estado de wallet, invitar
  amigos), SKINS, RANKING (nuevo, con tu fila resaltada), WALLET (conectar
  TON, comprar con Stars o TON, Exchange, Canjear DQ). Exchange/Canjear/Stars
  siguen siendo pantallas propias, accesibles desde WALLET.
- Quitados los botones de STAKING y DONAR SOL del menú (staking ya estaba
  apagado en el servidor por el riesgo legal de antes; se dejó solo el canal
  de Telegram).
- **`js/streak.js` no fijaba tamaño de fuente en su HTML** (a diferencia de
  `missions.js`): con la raíz en 26px, "RACHA: DÍA 1" salía gigante durante
  la partida. Corregido con tamaños explícitos, igual que hacen las misiones.
- **La landing (`index.html`) decía "Próximamente — Lanzamiento Q3 2025"**
  para la Mini App, que lleva meses viva. No había NINGÚN botón que abriera
  el bot, solo un canal de anuncios. Añadido un botón "JUGAR EN TELEGRAM"
  como CTA principal del hero, corregida toda la sección Telegram para
  reflejar que está activa, y los avisos de "función en desarrollo" ahora
  redirigen a la Mini App en vez de prometer una fecha falsa.

**Sin verificar (no lo pude probar sin una wallet TON real ni el bot en
producción):** que TON Connect efectivamente complete la conexión de punta a
punta dentro de Telegram real (el modal se abre correctamente en pruebas
locales, que es hasta donde se puede llegar sin credenciales reales).

**Observación, no corregida (decisión del dueño):** la sección ROADMAP de la
landing muestra "500/2.000 holders" y habla de un torneo con premio en SOL,
bridge a otras chains, listado en exchange centralizado. La auditoría de
seguridad de esta sesión midió on-chain 3-4 holders reales y ~$2.000 de
capitalización. Es una decisión de negocio, no la toqué, pero está muy lejos
de lo real.

## Tercera tanda (misma noche) — commits aplicados, revisión independiente y goblin animado

Se aplicaron los 6 commits de las dos tandas anteriores a `master` (rama
`campana-seguridad-hub-telegram`, fusionada localmente; **sin `git push`
todavía** — falta ejecutar el PASO A del SQL primero, ver arriba). Un agente
revisor auditó los 6 commits ya aplicados y encontró 2 cosas reales,
corregidas:

- **`_headers` no hacía nada.** Es una convención de Cloudflare *Pages*; este
  sitio es un Worker con Static Assets (`[assets]` en `wrangler.toml`), que
  no lo lee. Las cabeceras de seguridad (incluido el CORS del manifiesto de
  TON Connect, que sin esto pudo no funcionar) estaban en un archivo muerto
  y además publicado. Movidas a `worker.js`, envolviendo `env.ASSETS.fetch`.
  El archivo `_headers` se borró.
- Un sprite del pack `recursos/jefes/ansimuz-grotto-dragon` traía un
  `patreon-license.txt` que contradice el CC0 declarado por el mismo autor
  en OGA. No se usaba en ningún sitio y no se servía, pero se quitó del todo
  para no dejar ambigüedad en el repo.

También se cerró el pendiente nº4 de abajo: **`ton_sell` ahora retira
siempre a `profiles.wallet_ton`** (nunca al que mande el cliente en el
body) **y exige que lleve ≥24 h fijada** (`wallet_ton_actualizado`, que
mueve un trigger — el cliente no puede adelantarlo). Antes, un `initData`
robado (vale 6 h) bastaba para conectar la wallet del atacante y retirar en
el momento. Requiere el bloque A5 de `sql/02-seguridad.sql` (mismo Paso A).

**Enemigo "normal" con animación real** (`js/engine.js` + `tools/generar_enemigos_cc0.py`,
CC0 de Goblin Corps/Moikmellah): antes era un bitmap estático deformado por
código; ahora tiene ciclo de caminar (6 frames), daño (2) y muerte (2) de
verdad. Sirve de prueba de que SÍ encaja el pixel art de baja resolución
integrado a escala (con `imageSmoothingEnabled=false` no hace falta
reescalar el PNG, el motor ya dibuja nítido) — contradice la nota del punto
5 de abajo, que decía que "chocaba" con el detalle actual: probado, no
choca. Los demás tipos (charger/exploder/ghost/flyer/magmar/boss) siguen
con su bitmap propio; el tinte de élite y el resto del motor funcionan
igual sobre la hoja nueva sin cambios adicionales.

Verificado: partidas simuladas en varias etapas sin errores, la muerte por
hoja de animación tenía un bug real (doble aplastado: el frame de KO del
artista YA es un cuerpo colapsado, y el código le aplicaba ADEMÁS su propio
aplastamiento — el enemigo se volvía invisible 1-2 px). Corregido en
`animEnemigo()`: los enemigos con `e.sheet` se saltan el aplastado por
código en la muerte (usan solo el fade de alpha).

## Cuarta tanda (28-sep-2026, continuación) — Exchange real en la web + Términos y Privacidad

Rama `feat/canje-web-y-legal`, todavía **sin `git push`** — falta ejecutar
`sql/03-web-canje.sql` primero (instrucciones abajo).

**El Exchange/canje que en la tanda anterior no existía en ningún lado ahora
sí funciona en la web:**

- **Comprar skins con SOL, sin el hueco de seguridad que tenía antes.**
  Reescrito `functions/api/helius-verify.js` con el patrón "reference" de
  Solana Pay: el servidor genera una clave pública aleatoria única por
  orden (`create_sol_order`), la mete en la transacción como cuenta de solo
  lectura, y verifica el pago buscando esa referencia en la cadena de
  Solana — así saca la wallet REAL del que pagó en vez de confiar en lo que
  mande el cliente. Antes, cualquiera que viera un pago ajeno en Solscan
  podía copiar wallet+firma y reclamar la skin él. Era el mismo hueco que ya
  se había cerrado para TON en la primera tanda, pero nunca se aplicó al
  lado de SOL.
- **Canjear DQ ganado jugando por $DUENDE real, para cuentas web** (con
  email, sin pasar por Telegram): `web_start_run` / `web_submit_score` /
  `web_redeem` en `functions/api/wallet.js`, con el mismo ticket firmado
  anti-repetición que ya usaba Telegram. Se encontró y corrigió un hueco
  real en pruebas: un ticket válido se podía reenviar varias veces y
  agotar de un tirón el tope diario de DQ — ahora cada partida guarda su
  propio timestamp (`profiles.dq_last_run_ts`) y un ticket ya usado no
  vuelve a dar nada.
- Esto es **pago de recompensa por jugar** (el jugador nunca deposita nada),
  no un exchange con saldo interno — por eso sí se construyó, a diferencia
  del swap TON/SOL↔$DUENDE con saldo canjeable, que se queda apagado por el
  riesgo de PSAV descrito en `ESTRATEGIA-TOKEN.md`.
- Nuevo panel "CANJEAR DQ → $DUENDE" en `game.html` (pantalla de wallet),
  con sus dos estados (sin cuenta / con cuenta) probados en el navegador.
- `index.html`: los dos textos que mandaban a la Mini App de Telegram a
  comprar/canjear $DUENDE ahora apuntan a `game.html#wallet`.

**Términos de Servicio y Política de Privacidad** — `terminos.html` y
`privacidad.html`, nuevos, enlazados desde el pie de `index.html` y desde
la pantalla de wallet de `game.html`. Cubren: qué es DQ vs $DUENDE, que no
somos una casa de cambio ni custodiamos fondos, que las wallets son no
custodiales, riesgo/volatilidad de $DUENDE, qué datos se recogen y con qué
proveedores se comparten (Supabase/Cloudflare/Helius/Telegram), y los
derechos ARCO bajo la Ley 29733 peruana. Contacto:
sonicoperuoficial@gmail.com (puesto ahí porque no hay otro email de
soporte en el proyecto — si tienes uno mejor, dímelo y lo cambio).

### Cómo ejecutar `sql/03-web-canje.sql` (necesario para que el canje web funcione)

Es el mismo procedimiento que ya hiciste con `sql/02-seguridad.sql`:

1. Entra a supabase.com → tu proyecto → en el menú de la izquierda, el ícono
   ⚡ "SQL Editor".
2. Click en "+ New query" (si sale un aviso de que los snippets ya no se
   guardan solos, ciérralo, no afecta).
3. Abre `sql/03-web-canje.sql` en la carpeta del proyecto, selecciona todo
   (Ctrl+A) y cópialo (Ctrl+C).
4. Pégalo (Ctrl+V) en el cuadro grande del SQL Editor, reemplazando lo que
   hubiera ahí.
5. Dale al botón verde "Run" (o Ctrl+Enter).
6. Al final debe salir una tabla con 2 filas (`accrue_dq_web`,
   `redeem_dq_web`) con la columna `prosecdef` en `true`. Si sale así,
   quedó bien.
7. Avísame cuando lo hayas corrido para hacer el `git push`.

## Pendiente

1. **Probar en un móvil real** dentro de Telegram (sobre todo el flujo de pago
   TON con el resto, que no se puede probar sin wallet real).
2. **Skins solo cosméticas:** hoy dan ventaja (`coinMult`, `atkMult`,
   `lifesteal`, `bonusHp`) y cuestan 25-250 USD. Con ranking, eso es pagar por
   ganar, y `coinMult` sobre DQ canjeable por $DUENDE se parece a rendimiento
   (riesgo legal, ver `ESTRATEGIA-TOKEN.md`). Recomendación: cosméticas a
   1-5 USD. **Decisión del dueño**, no se tocó.
3. ~~**Quitar lo cripto de la Mini App**~~ — hecho (2026-09-28, decisión del
   dueño). Comprar $DUENDE con TON/Stars, el Exchange y Canjear DQ se
   quitaron de `telegram/index.html` y se apagaron en el servidor
   (`SWITCHES.ton_buy/ton_sell/request_redemption = 'off'` en
   `functions/api/wallet.js`); solo funcionan en la web. ~~Ojo: la web
   todavía no tiene un Exchange ni un Canjear DQ que funcionen de
   verdad~~ — hecho esta tanda, ver arriba.
4. ~~`ton_sell`: tope diario y retiro solo a wallet registrada hace >48 h~~
   — hecho esta tanda (24 h, ver arriba).
5. Integrar más packs de `recursos/` (ver `recursos/INDICE.md`). ~~El goblin
   normal (arriba) demuestra que el pixel art de baja resolución SÍ encaja
   escalado~~ — confirmado y ampliado en la sexta tanda: 4 enemigos más
   (esqueleto, goblin samurai/mago, hongo) + 3 variantes de fondo. **Sigue
   pendiente**: los tilesets Tiled (mapas reales con plataformas de
   GothicVania/Rocky Pass/Sunny Land en vez de las plataformas
   proceduralmente generadas que usa el motor hoy) — es un cambio de
   arquitectura más grande (parsear TMX/JSON, geometría real de nivel),
   no una sustitución de sprite. Quedan también por usar: el resto del
   pack Goblin Corps (7 de 10 variantes sin tocar), la seta invertida
   (élite de hongo), el pack ansimuz-sideview-fantasy completo (rana,
   lagarto, serpiente, fantasma, dragón volador — mini-jefe candidato),
   y GothicVania Church (mago/ángel oscuro, candidato a jefe nuevo).
6. ~~**Términos de Servicio y Política de Privacidad**~~ — hecho esta
   tanda, ver arriba (`terminos.html`, `privacidad.html`).

## Sexta tanda (29-sep-2026) — 3 agentes en paralelo

El dueño pidió seguir mejorando "todo el día" y desplegar agentes para
explorar el juego y buscar en internet qué mejorar. Se lanzaron 3 agentes
en worktrees aislados (cada uno con su propia rama, revisados y fusionados
a mano tras verificarlos, no fusionados a ciegas):

- **Auditoría de UI en `telegram/index.html`** (mismo tipo de bug que la
  tienda de skins web, buscado explícitamente ahí): no se repite — ese
  archivo ya pone `overflow-y:auto` en el propio overlay, no en un hijo
  flex. Sí encontró y quitó `loadStartRanking()`: una consulta a Supabase
  en **cada apertura** de la Mini App para un contenedor
  (`#start-rank-list`) que ya no existe desde el rediseño a 5 pestañas —
  gasto puro, sin efecto visible. También un event listener huérfano de
  `ton-amount-input` (input que ya no existe, mismo commit que lo quitó
  se olvidó del listener). De paso encontró que `index.html` (la landing,
  más tráfico que la Mini App) tenía el mismo link muerto de Telegram
  (`t.me/duendequest_bot/app`) que ya se había arreglado adentro de la
  Mini App — arreglado también, y de paso se encontró y limpió
  `make_banner.py`: generaba un banner promocional (sin usar en ningún
  lado, pero servido público en `assets/`) que todavía prometía "Staking
  up to 240% APY" — la promesa exacta con riesgo penal por la que el
  staking está apagado en todo el sitio desde hace varios commits.
- **Más bestiario CC0**: esqueleto (MV Platformer Skeleton, va a NOCHE y
  TORMENTA junto al goblin), goblin samurai (DESIERTO) y goblin mago
  (TORMENTA) del mismo pack Goblin Corps ya integrado, y hongo (Big
  Mushroom, SELVA) — el primer enemigo no-humanoide del juego. Todos
  reusan el sistema de hoja de animación sin tocar `sheetFrame()`/
  `drawSheet()`. Verificado con partidas simuladas reales en los 5
  biomas (no solo sintaxis): cero errores.
- **Auditoría numérica de balance**: encontró que DAGAS (pensada "rápida
  pero floja") hacía MÁS daño por segundo que ODACHI (el arma pensada
  para pegar fuerte) y que la KATANA inicial, por un redondeo
  (`Math.ceil` sobre el multiplicador de combo) que anulaba casi toda la
  reducción de daño declarada. Corregido (`dano: .6` → `.3`). Revisó
  también la curva de recompensas de misiones/logros, el precio de la
  tienda DQ vs. ingreso realista de monedas, y el costo de revivir — todo
  consistente, no tocó nada ahí. Señaló (sin tocarlo, por ser decisión de
  diseño con dinero real de por medio) que **completar una etapa de
  campaña sin morir nunca acredita $0 de DQ canjeable** — solo el modo
  SIN FIN llama a `submit_score`/`accrue_dq`. Probé esto por separado con
  el jugador automático hasta wave 20 en SIN FIN priorizando siempre
  daño/cadencia al elegir mejora (el peor caso para "los jefes se vuelven
  triviales"): el tiempo para matar a cada jefe **no baja**, sube (619
  frames en wave 3 → 996 en wave 18), así que la curva de jefes aguanta
  bien incluso a un jugador agresivo — no hacía falta tocarla.

Los 3 se revisaron (diff leído, sprites vistos con el Read tool antes de
fusionar, sintaxis verificada, y para los dos que tocaban `js/engine.js`
se confirmó que el merge automático combinó ambos sin perder nada) y ya
están en producción.

## Quinta tanda (29-sep-2026) — tienda de skins, TON Connect y cloud save

El dueño avisó dos cosas: "no puedo comprar las skins en la web" y "al
darle click a conectar wallet en Telegram no conecta nada". Las dos eran
bugs reales, no percepción:

- **Tienda de skins invisible.** `#ov-skin-shop` vive en una caja de 320px
  compartida por todas las pantallas. Con 6 skins detalladas el contenido
  no cabía: el grid tenía su propio `overflow-y:auto`, y en CSS eso hace
  que el alto mínimo automático de ese elemento sea 0 — flexbox lo
  aplastó a ~70px en vez de respetarle su `max-height`. Además la pantalla
  estaba centrada (`justify-content:center`), así que al desbordar el
  scroll empezaba mostrando el CENTRO del contenido, no el principio. El
  resultado visual: título, botón "Conectar Phantom" y nada más — ninguna
  skin de pago ni su botón "Comprar" se veían jamás. No era un problema de
  Solana Pay ni de Helius: las skins nunca llegaban a ser clickeables
  porque nunca se veían. Arreglado solo en esa pantalla (`justify-content:
  flex-start` + `overflow-y:auto` en el modal, `flex-shrink:0` en cada
  fila) — audité las otras 8 pantallas (`.ov`) por el mismo patrón y
  ninguna más lo tenía (son las únicas dos: la única otra que usa un
  `overflow-y:auto` propio).
- **TON Connect no volvía al juego.** `twaReturnUrl` apuntaba a
  `t.me/duendequest_bot/app`, un link que no corresponde a nada real (el
  bot abre el juego con botones `web_app` ad-hoc, no como Mini App con
  nombre corto registrado en BotFather). Un jugador con wallet externa
  aprobaba la conexión allá y Telegram no tenía adónde volver — se quedaba
  en la wallet, el juego nunca reflejaba la conexión. Cambiado al link del
  bot a secas (`t.me/duendequest_bot`, siempre válido).
- **Cloud save real** (`sql/04-cloud-save-web.sql`, ejecutado y confirmado
  por el dueño). Ya existía para Telegram (monedas, nivel, XP, racha) pero
  nunca incluía las estrellas de campaña, y la web no tenía nada de esto —
  cambiar de dispositivo o borrar datos del sitio perdía todo el progreso
  sin remedio. Ahora `profiles.campaign_stars` guarda las estrellas y
  `web_sync_progress`/`sync_progress` (con saneado compartido,
  `cloudSavePatch()` en `wallet.js`) suben/bajan todo el progreso
  cosmético para cuentas web y de Telegram por igual.
- **Verificación con jugador automático** (mismo patrón de siempre: driver
  `startGame()`/`update()` en bucle desde la consola, manejando también
  `eligiendo` — pantalla de mejora — y `descanso` — pantalla entre
  oleadas). Corrida completa de SIN FIN hasta wave 3 con 7 mejoras
  elegidas y 2 descansos, e intento de la etapa jefe 1-3: cero errores de
  consola en ambas, misiones y logros se marcaron bien, game over y
  guardado local funcionaron.

**Sin verificar (no lo pude probar sin Telegram real ni una wallet
externa real):** que el flujo completo TON Connect ↔ Tonkeeper/wallet de
Telegram efectivamente complete la conexión de punta a punta en
producción — el fix corrige un bug concreto y verificable en el código,
pero el "camino feliz" completo solo se puede confirmar con el dueño
probando en su teléfono.
6. Términos de servicio y privacidad (`ESTRATEGIA-TOKEN.md`).

## Séptima tanda (29-sep-2026) — 6 agentes en paralelo, jefe final y ranking real

El dueño pidió "mejora todo el día, no pares hasta que se acabe la
ventana de contexto" y desplegar agentes para explorar el juego y buscar
en internet qué mejorar. Se lanzaron 6 agentes en total, en 2 rondas, cada
uno en su worktree aislado, todos revisados (diff leído, sprites vistos
con el Read tool, sintaxis verificada, y para los que tocaban
`js/engine.js` se confirmó que el merge automático combinó todo sin
perder nada) y probados en vivo con el jugador automático antes de
fusionar a master:

**Bugs reales encontrados y arreglados:**
- `telegram/index.html` hacía una consulta a Supabase en **cada apertura**
  de la Mini App para un panel (`#start-rank-list`) que ya no existe desde
  el rediseño a 5 pestañas — puro gasto, sin efecto visible. También un
  event listener huérfano de un input que ya no existe.
- `index.html` (landing) tenía el mismo link muerto de Telegram
  (`t.me/duendequest_bot/app`) que ya se había arreglado dentro de la Mini
  App — arreglado también aquí (es el botón de más tráfico del sitio).
- `make_banner.py` generaba un banner promocional (sin usar en ningún
  lado, pero servido público en `assets/`) que todavía prometía "Staking
  up to 240% APY" — la promesa exacta con riesgo penal por la que el
  staking está apagado en todo el sitio. Arreglado.
- `og:url` apuntaba a un dominio (`duendequest.com`) que nadie posee —
  cambiado al dominio real. No existía favicon en ningún archivo del
  proyecto — agregado.
- **Bug real de cálculo en donaciones** (formulario en vivo, transacción
  SOL de verdad firmada al dev wallet): `updateDuendeRate()` calculaba
  "tokens por $1" en vez de "tokens por SOL" (le faltaba multiplicar por
  el precio de SOL) y sobreescribía cada 30s la tasa que la misma
  pantalla promete arriba, dejándola en ~1-2% de lo prometido. Arreglado.
- `index.html#exchange` prometía "entra a tu wallet dentro del juego" con
  un link a `game.html#wallet` que no hacía nada (el fragmento no tenía
  ningún listener). Ahora sí abre el panel.
- **DAGAS pegaba más fuerte que ODACHI y KATANA**, al revés de su diseño
  ("rápida pero floja"): `Math.ceil` sobre el multiplicador de combo
  anulaba casi toda la reducción de daño declarada. Verificado con la
  matemática exacta (ciclo de 3 golpes: 9,4 daño/s vs 8,2 de ODACHI),
  corregido.
- **Ranking global de la landing era 5 nombres inventados** (DUENDE_MASTER,
  EL_REY_420...) con un badge parpadeante "● LIVE" y "Actualizado en
  tiempo real · Powered by Supabase" que nunca estuvo conectado a nada.
  Se le preguntó al dueño qué hacer (conectarlo de verdad / relabel /
  quitarlo / dejarlo) y eligió conectarlo: ahora `cargarRankingLanding()`
  llama a la MISMA `_fetchLeaderboard()` que ya usa el ranking del juego,
  sin duplicar lógica. Con solo 2 jugadores reales hoy se ve corto, pero
  ya no miente.

**Contenido nuevo — bestiario:** de 2 enemigos con hoja de animación (goblin
normal + esqueleto) a **13**: goblin samurai/mago/peasant/assassin/
centurion/battlelord, hongo, lagarto, serpiente, ghoul ardiente, hechicero
— repartidos por los 5 biomas (`SHEET_POR_BIOMA` en `js/engine.js`), cada
uno verificado con PIL antes de integrarlo (nunca confiando en la
documentación del pack) y probado en combate real en su bioma.

**Jefe final de la campaña con silueta propia.** Los 5 jefes eran el MISMO
bitmap (`oso`, solo cambiaba el tinte por bioma). La etapa 5-3 (cierre de
las 15 etapas) ahora pelea contra un ángel de verdad (GothicVania Church,
CC0) — primer jefe con hoja de animación. `spawnJefe()` ganó un 4to
parámetro (nombre explícito, para no salir "FARAÓN DORADO" solo por el
bioma) y ahora pone `e.sheet` cuando el tipo de jefe tiene una hoja
definida, sin tocar el resto del sistema de ataques/telegrafiado (ya era
genérico). HP 220 (vs ~130-150 de los jefes anteriores) — escalada real
para un cierre de campaña. Probado en vivo de punta a punta: spawn →
pelea real → las 4 fases de estado → muerte → "¡VICTORIA!".

**Verificación final:** corrida del jugador automático en los 5 biomas
+ el jefe final, **en producción** (no solo local), cero errores de
consola en ninguna. El ranking real de la landing confirmado mostrando
jugadores de verdad de la base de datos de producción.

## Octava tanda (29-sep-2026, continuación) — bestiario a 18, meta de colección y cierre de campaña con más peso

Todo esto en agentes/worktrees separados, revisado (diff + sprites vistos con
PIL antes de integrar) y verificado en vivo con el jugador automático antes
de mergear, igual que las tandas anteriores.

**Contenido nuevo — bestiario (13 → 18 con hoja de animación):**
- `ghoul_ardiente` y `hechicero` (bioma tormenta).
- `goblin_guard`, `goblin_knight` (bioma amanecer), `rana` (bioma selva),
  `fantasma` (bioma noche), `pajaro` (bioma amanecer).
- `rana` fue el primer sprite con celdas de tamaño distinto en ambos ejes
  entre el frame de caminata y el de golpe/muerte del pack fuente — se
  verificó a mano en movimiento (forzando un spawn y usando `zoom`/
  screenshot) que no salta de tamaño ni desalinea las patas contra el
  suelo; quedó bien.
- `SHEET_POR_BIOMA` (`js/engine.js`) queda así (noche/amanecer/selva/
  tormenta/desierto): cada bioma con 4-5 enemigos normales propios, sin
  reciclar el mismo bicho entre biomas salvo `goblin_normal` (el base).

**Meta de colección — "Bestiario" (nuevo sistema, cero deuda futura):**
- `markBestiaSeen()`/`bestiarioSeen()`/`bestiarioTotal()` en `js/engine.js`:
  guarda en `localStorage` (`dq_bestiario`) qué sprites ya viste en combate.
  `bestiarioTotal()` cuenta `Object.keys(SHEETS).length - 1` (excluye al
  ángel, que es jefe) — **si se agrega un enemigo nuevo con hoja de
  animación en el futuro, la meta crece sola, sin tocar código.**
- Logro nuevo `bestiario` (+120 DQ) en `js/achievements.js`, se dispara solo
  al completar la colección.
- Pantalla de muerte (`nearMissLines`) ahora también puede mostrar
  "📖 Bestiario: X/Y criaturas descubiertas" como gancho de FOMO, junto a
  las demás pistas ya existentes (comparte el tope de 3 líneas).

**Cierre de campaña con más presencia:**
- Al ganar la etapa 5-3 (última del juego), la pantalla de victoria ahora
  suma la línea "🏆 CAMPAÑA COMPLETADA — DERROTASTE AL ÁNGEL CAÍDO 🏆"
  además del "¡VICTORIA!" normal.
- El mapa de campaña (`abrirMapa()`) ahora distingue el jefe final: corona
  👑 en vez de calavera ☠ en el botón de la etapa 5-3, para que se note a
  simple vista cuál etapa tiene al jefe de verdad distinto.
- El aviso "NUEVO" del menú principal, que seguía anunciando una feature
  vieja (explotadores/fantasmas de hace varias tandas), ahora dice
  "🆕 NUEVO: BESTIARIO AMPLIADO 📖 Y JEFE FINAL 👑" — reflejando lo que de
  verdad se agregó más recientemente.

**Verificación:** jugador automático corrido en los biomas noche/amanecer/
selva tras el merge (sin errores de consola, sheets vistos coinciden con
`SHEET_POR_BIOMA`); spawn forzado de `rana` en vivo para revisar su
animación en detalle. Push a `origin/master` confirmado en producción vía
curl (`engine.js` en vivo con `goblin_guard`, `goblin_knight`, `'rana'`,
`fantasma`, `pajaro`).

**Pendiente / reservado para más adelante:**
- `goblin_lord` (del pack de variantes goblin) — se decidió no integrarlo
  aún, se ve mejor como jefe de un futuro bioma castillo que como enemigo
  normal más.
- El dragón (pack sunny-land) — reservado para un futuro intento de jefe
  bien diseñado y probado en vivo, no se apuró su integración esta vez.
- Bestiario ahora en 18 criaturas + 1 jefe con hoja; quedan biomas con
  solo 3-4 sprites propios si se quiere seguir engordando el pool.

## Novena tanda (29-sep-2026) — 3 agentes de auditoría en paralelo (balance, seguridad, móvil)

Primero se confirmó que los dos pedidos originales de esta sesión larga siguen
resueltos y verificados en producción: TON Connect en el bot de Telegram
conecta de verdad (`twaReturnUrl` real, manifest y su ícono responden 200 en
producción) y el progreso se sincroniza a la nube en victoria/derrota
(`syncProgressToCloud()` en `telegram/index.html`).

**Auditoría de balance de armas (las 4 del juego: KATANA/ODACHI/CHISPA/
DAGAS)** — matemática exacta del DPS real de cada una (ciclo completo de
combo de 3 golpes). Resultado: ODACHI 8.18/s > KATANA≈CHISPA 5.71/s > DAGAS
5.625/s. Coincide con lo que cada arma promete ser (ODACHI lenta pero fuerte,
DAGAS rápida pero floja, CHISPA es un sidegrade de utilidad — daño en área a
cambio de menos empuje, no una arma "fuerte/floja"). **No se tocó nada, todo
estaba bien** (el bug de DAGAS de esta misma sesión, más arriba en este
archivo, ya lo había corregido).

**Bug de seguridad real encontrado y corregido — `functions/api/lib.js`,
`findTonPayment()`:** no envolvía la consulta a toncenter (API externa) en
try/catch, y devolvía `null` en vez de array cuando toncenter fallaba
(rate limit, timeout, mantenimiento). Los 3 llamadores (`ton_buy`,
`ton_stake`, `skin_ton`) hacen `pagos.length` sin comprobar null → un
jugador que pagara TON justo cuando toncenter tuviera un hipo veía un
error genérico 500 en vez del 402 "espera y reintenta" que el propio
código ya tenía pensado, sin perder el pago (el dinero seguía bien, era
solo un mensaje de error confuso). Corregido: ahora siempre devuelve un
array, nunca lanza. Además se auditó TODO `functions/api/` (auth, clamps
de `cloudSavePatch`, condiciones de carrera en saldo/canje, el sistema de
"dust" de pagos TON — genuinamente verificado on-chain, no de confianza
del cliente) sin encontrar ningún otro problema explotable.

**3 bugs reales de CSS móvil encontrados y corregidos:**
- `index.html`: faltaba `overflow-x:hidden` en `<html>` (solo lo tenía
  `body`) — el ticker/marquee de 2031px de ancho inflaba el viewport móvil
  de 375px a 504px reales, sacando el badge de precio del header fuera de
  pantalla y habilitando scroll horizontal en todo el sitio.
- `index.html`: la grilla de tokenomics (`.tgrid`) tenía un
  `grid-template-columns` inline de 4 columnas fijas que ignoraba el
  responsive de la clase — la 4ta tarjeta quedaba cortada en móvil. Ahora
  2x2 en `max-width:700px`.
- `index.html`: el botón flotante de la moneda se solapaba con
  "Política de Privacidad" del footer en móvil sin forma de despejarlo con
  scroll — se le agregó `padding-bottom:7rem` al footer en ese mismo media
  query.
- **`game.html` (el más importante, afectaba TAMBIÉN a escritorio, no solo
  móvil):** las capas `.ov` (menú principal, pausa, tienda, wallet, ranking,
  cuenta) usaban `position:absolute;inset:0` dentro de `#wrap`, cuyo alto lo
  fija el canvas del juego (bastante más bajo que el viewport real) — el
  contenido del menú se salía de ese recuadro y quedaba mezclado
  visualmente con el HUD (SCORE/HP/WAVE) que sigue debajo en el documento.
  Arreglado igual que ya se había hecho para `#ov-niveles` (el mapa) y
  `#ov-skin-shop` (la tienda, tanda anterior): `position:fixed` +
  `overflow-y:auto`, cubre el viewport real completo.

**Verificación:** los 4 fixes de CSS confirmados en vivo en producción con
el navegador integrado en 375px (sin scroll horizontal, sin overlap) y en
1024px (tokenomics sigue en 4 columnas, sin regresión). El fix de
`findTonPayment` verificado con `node --check` (sintaxis) — no se puede
probar en vivo sin una wallet TON real y un pago real, se confía en la
lectura de código + el patrón ya usado en el resto del archivo.

Limpieza de housekeeping: se borraron 8 worktrees/branches de rondas
anteriores ya mergeadas a master (`git worktree remove` + `git branch -D`),
solo quedaban acumulando espacio en disco sin ningún propósito.

## Décima tanda (29-sep-2026) — cache de assets y tope de referidos

**Rendimiento — ningún archivo estático se cacheaba, ni siquiera un PNG que
nunca cambia.** `worker.js` servía TODO (HTML, JS, imágenes, hojas de
sprites) con `Cache-Control: public, max-age=0, must-revalidate` porque
`env.ASSETS.fetch()` no pone cache real y nadie lo sobreescribía (el
`_headers` de una sesión previa no aplica porque este sitio usa Static
Assets, no Cloudflare Pages — ya documentado en el propio `worker.js`).
Con `run_worker_first=true` cada request pasa por el Worker de todas formas,
así que ahí mismo se puede decidir la cabecera. Ahora: `assets/*` (los PNG
de sprites/UI, audio) cachea 1 día (`max-age=86400,
stale-while-revalidate=3600`) — HTML y JS del motor (`game.html`,
`js/engine.js`, etc.) siguen en `max-age=0` a propósito, porque no tienen
nombre con hash y se despliegan varias veces por hora: cachearlos dejaría a
jugadores atascados en una versión vieja (con bugs ya arreglados) sin
enterarse. Verificado en producción: `assets/ui/coin.png` y las hojas de
sprites devuelven la cabecera nueva, `game.html`/`engine.js` siguen igual.

**Seguridad — el bono de referidos no tenía tope.** La auditoría de la
tanda anterior había señalado (sin arreglar, por ser "diseño de producto")
que `handleReferral()` en `functions/api/telegram-bot.js` acredita 500
$DUENDE al referente por CADA cuenta nueva de Telegram que entre con su
link, sin ningún límite — una sola persona con cuentas desechables podía
drenar el suministro sin tope. Se agregó un tope real y barato de
implementar (no requería tocar el esquema SQL, solo contar filas de
`referrals` por `referrer_tg_id`, columna que ya se usaba): máximo 20
referidos pagados por persona. Por encima de eso el bono se corta (la
cuenta nueva referida igual puede jugar normal, solo no llega el "+500 al
referente"). Verificado que el resto de la API (`/api/wallet` vía POST)
sigue respondiendo bien tras el deploy.

**Nota aparte (sin tocar, informado y decidido por el dueño):** `index.html`
tiene un botón "STAKEAR AHORA" real en la landing (`js/staking-manager.js`)
que manda SOL de verdad a la wallet del dueño en Solana mainnet prometiendo
devolver $DUENDE con rendimiento — la MISMA exposición penal ya documentada
para el staking en TON (`ESTRATEGIA-TOKEN.md`, art. 11 Ley 26702 / art. 246
Código Penal peruano) que llevó a apagar `ton_stake` con un switch. Se le
preguntó explícitamente al dueño qué hacer con esta versión en Solana de la
web; su decisión (29-sep-2026): **dejarlo activo**. No se tocó nada de
`js/staking-manager.js` ni de `index.html` en esa sección.

## Onceava tanda (29-sep-2026) — SEO de vista previa e instalación como app

**`og:image`/`twitter:image` de la landing usaban ruta relativa** (a
diferencia de `og:url`, que ya era absoluta) — los crawlers de vista previa
de Telegram/Twitter/Discord no siempre resuelven rutas relativas de forma
fiable. Además apuntaban a `skin_hero.png` (222x210, pixel art suelto con
fondo transparente) en vez de un banner horizontal — mal formato para
`summary_large_image`. Cambiado a URL absoluta apuntando a
`assets/telegram_app_banner.png` (640x360, ya es un banner hecho para esto,
limpiado de afirmaciones falsas esta misma sesión). Verificado en vivo.

**`game.html` no tenía soporte de "Agregar a pantalla de inicio"** (PWA
básico) — sin `manifest.json` ni `apple-touch-icon`, instalar el juego desde
un navegador móvil normal (fuera de Telegram) no daba un ícono propio en
Android y no ofrecía nada limpio en iOS Safari. Se agregó `manifest.json`
(raíz del repo, mismo patrón que `tonconnect-manifest.json`) con
`start_url: /game.html`, `display: standalone`, colores del tema, e íconos
generados desde `assets/ui/coin.png` (la moneda del juego, ya bien
compuesta como medallón) escalados sin suavizado a 192/512/180px con fondo
sólido (no transparente, para que iOS no rellene con blanco). `game.html`
ganó los `<link>`/`<meta>` correspondientes. Nota de despliegue: el
`manifest.json` nuevo tardó ~1 min extra en propagarse en el edge de
Cloudflare tras el push (servía el fallback SPA/HTML mientras tanto) —
normal para un archivo nuevo, ya se resolvió solo; no hace falta reintentar
nada si pasa de nuevo con un archivo top-level nuevo.

**Nota aparte, sin arreglar (muy baja prioridad):** `robots.txt` y
`sitemap.xml` tampoco existen — cualquier ruta no reconocida cae al mismo
fallback SPA (sirve `index.html` con 200 OK, cuidado si algo hace
`curl -o /dev/null -w '%{http_code}'` para "verificar" que un archivo
existe: el código 200 no prueba nada en este sitio, hay que mirar
`Content-Type` o el cuerpo real). No es un problema funcional (sin
robots.txt el comportamiento por defecto de cualquier crawler es "permitir
todo"), solo una ausencia de un archivo SEO "nice to have" — de muy bajo
valor dado que el crecimiento de este proyecto es 100% social/orgánico
(Telegram/Twitter), no por buscadores.

## Doceava tanda (29-sep-2026) — conejo del desierto, bestiario a 19 y biomas parejos

Último enemigo del pack Ansimuz Sideview Fantasy que quedaba sin usar:
`sunny-bunny` → `conejo`, integrado en DESIERTO DORADO (índice 4 de
`SHEET_POR_BIOMA`), que junto con TORMENTA se había quedado en 4 enemigos
normales en vez de 5 — ahora los 5 biomas quedan parejos. Ciclo de caminar
reutiliza el "run" del pack (34x44, ya anclado al suelo); golpe/muerte se
recortan de 2 poses aisladas del frame de "jump" (agazapado + extendido),
re-centradas dentro de la celda de run con el mismo truco de re-anclaje que
ya usó `rana`.

**Se evaluó y se descartó** integrar `sunny-mushroom` (la otra criatura sin
usar del mismo pack): comparado visualmente con PIL contra el `hongo` ya
existente (bioma selva, pack distinto — Scratchio) resultó ser el mismo
concepto para el jugador (capuchón moteado sobre cuerpo bulboso caminando),
solo con otro trazo — se hubiera sentido como un reskin, no una criatura
nueva. Documentado en `CREDITOS.md`/`recursos/INDICE.md`, mismo criterio que
ya se usó con `goblin_lord` y el dragón en tandas anteriores.

Verificado en vivo (spawn forzado en bioma desierto, capturas de pantalla):
el conejo se para correctamente sobre el suelo, tamaño y silueta legibles,
sin errores de consola en la campaña completa. **Bestiario: 19 criaturas +
1 jefe con hoja de animación**, `bestiarioTotal()` sigue sin tocarse (cuenta
sola).

Con esto, los packs CC0 ya descargados en `recursos/enemigos/` están
agotados salvo las 2 reservas explícitas de tandas anteriores (`goblin_lord`
para un futuro bioma castillo, el dragón `sunny-dragon` para un futuro
intento de jefe bien probado en vivo) y `sunny-mushroom` (descartado por
redundante, arriba). Cualquier ronda de contenido futura necesitaría buscar
un pack CC0 nuevo.

## Treceava tanda (30-sep-2026) — vincular wallet TON tambien desde la web

Pedido explícito del dueño: poder vincular la wallet en TON tanto desde la
web como desde Telegram (antes solo Telegram tenía TON Connect; la web solo
tenía Solana/Phantom vía `js/wallet-manager.js`).

**`game.html`** ahora carga el mismo SDK `@tonconnect/ui` y el mismo
`tonconnect-manifest.json` ya en producción que usa `telegram/index.html`.
Nueva tarjeta "TON WALLET" en el panel de wallet (`#ov-wallet`), junto a la
de Solana — botón "CONECTAR WALLET TON" abre el modal real (QR + lista de
wallets: Tonkeeper, Wallet in Telegram, etc.). Sin `twaReturnUrl` (eso es
específico de volver a un chat de Telegram; en una pestaña normal el SDK ya
maneja el regreso solo).

**Backend:** nueva acción `web_update_profile` en `functions/api/wallet.js`
— mismo patrón exacto que `update_profile` (la versión Telegram) pero con
`verifySupabaseUser`/`access_token` en vez de `verifyInitData`/`init_data`.
Guarda `profiles.wallet_ton` identificando al dueño por su sesión de
Supabase, para que quede vinculada sin importar si el jugador entra por
Telegram o por el navegador — mismo campo, dos caminos de auth.

Verificado en vivo en producción: el modal de TON Connect abre de verdad
(QR generado, manifest válido), `POST /api/wallet {action:web_update_profile}`
responde `401 auth_failed` con token inválido (confirma que la ruta está
desplegada y valida identidad antes de tocar la base de datos, igual que el
resto de acciones). Corrida de campaña sin errores de consola tras el
cambio.

## Catorceava tanda (30-sep-2026) — segundo jefe con sprite propio: sabueso infernal

Búsqueda en internet de un jefe CC0 gratuito para reemplazar otro de los 4
"oso reciclado" (solo el ángel, jefe final, tenía sprite propio). Se
investigaron y descartaron 3 candidatos antes de encontrar uno bueno:
- "Mecha-Stone Golem" (Kronovi) — prohíbe explícitamente redistribuir.
- "2D Pixel Art Golems Pack" (MonoPixelArt) — prohíbe explícitamente
  modificar Y redistribuir (bloquea directamente el pipeline de este repo).
- "Animated Pixel Minotaur" (rvros) — genuinamente CC0, pero cuesta $1.50
  mínimo; no se compró sin permiso explícito (se le preguntó al dueño, pidió
  seguir buscando opciones gratis primero).

**Encontrado y usado:** "Hell Hound Sprite Animation" (ansimuz — mismo
creador de confianza cuyo pack GothicVania Church ya dio el sprite del
ángel). Gratis ($0 real, no "pay what you want" con piso), y el zip trae su
propio `public-license.pdf` que declara CC0 explícito ("no restrictions on
use, modification, or redistribution") — más claro todavía que el texto de
la página.

Integrado como **SEGUNDO jefe con silueta propia**, en la etapa **1-3
(NOCHE VIOLETA)** — la PRIMERA etapa con jefe de la campaña, no la última
(el ángel sigue siendo el cierre en 5-3). HP/ataques/aviso/pausa copiados
literales de `JEFES.oso` a propósito: el objetivo era darle sprite propio
al primer jefe sin retocar una dificultad ya afinada. Las etapas 2-3/3-3/4-3
siguen con oso reciclado.

`bestiarioTotal()` se ajustó para excluir también a `hellhound` del conteo
del logro "bestiario completo" (igual que ya excluía a `angel`) — sin este
ajuste el logro se hubiera vuelto inalcanzable (contaría una criatura que
nunca se marca como "vista" por `markBestiaSeen`, al ser jefe).

Verificado en vivo con el flujo REAL de producción (completar 1-1 y 1-2 de
verdad, entrar a 1-3, confirmar `nivel.jefe.tipo==='hellhound'`, dañar al
jefe, ver el death-fade): sin errores. Corrida completa de los 15 niveles
tras el merge, sin errores de consola, cada bioma con su bestiario correcto
y el jefe correcto en su etapa (1-3 hellhound, 5-3 angel, las demás oso).

**Balance de jefes con sprite propio, 2 de 5:** ángel (final, HP 220) y
sabueso infernal (apertura, HP 70, sin cambios de balance). Quedan 3-3 y 4-3
si se quiere seguir esta línea en el futuro (packs CC0 de ansimuz/otros
creadores ya agotados para esta ronda; buscar de nuevo si se retoma).

## Quinceava tanda (30-sep-2026) — codigo muerto inseguro eliminado

Auditoria manual de `js/auth-manager.js` completo (no se había revisado a
fondo esta sesión). Encontrado: `loginWithTelegram(initData)` — tomaba
`initData` SIN verificar su firma HMAC (a diferencia de `link_profile` en
`functions/api/wallet.js`, que sí la verifica contra el token del bot) y
hacía un `upsert` DIRECTO desde el cliente a `profiles` por `telegram_id`.

Como el `telegram_id` de cualquier jugador es público (aparece en su propio
link de referidos, `t.me/duendequest_bot?start=ref_<id>`), alguien con solo
ese número podía fabricar un `initData` falso y llamar a esta función para
sobreescribir el `username` de OTRO jugador (no el saldo ni la wallet,
solo el username — pero suficiente para vandalismo/suplantación en el
ranking). Hoy no era explotable en la práctica porque `profiles` tiene
`INSERT` revocado para `anon`/`authenticated` (bloquea también el upsert,
ver `sql/01-blindaje.sql`), pero confiar solo en ese permiso de base de
datos como única defensa de una función insegura por diseño es frágil —
cualquier cambio futuro en los grants la reactivaría sin que nadie se
diera cuenta.

Confirmado con grep en todo el repo: **cero call sites**, en ningún HTML ni
JS — código vestigial de antes de que existiera `link_profile`, nunca
llamado desde ninguna UI. Eliminado por completo. Verificado en vivo: login
por email/password y registro siguen funcionando, ranking global carga
bien, sin errores de consola nuevos.

## DUENDE QUEST ONLINE — el MMORPG (30-sep-2026)

Pedido del dueño: "hazlo MMORPG aparte, decide tú cómo, con assets gratis o
generados, usa Unity si puedes, que conserve la esencia, todas las skins,
poderes y la tienda".

**Decisiones:**
- **Sin Unity.** No está instalado, activarlo pide la cuenta/licencia del
  dueño, y su build web pesa 20-40 MB: malo para Telegram en móvil, que es
  donde está el público. Se hizo con la misma tecnología que el arcade
  (HTML5 Canvas + JS), así funciona en web y como Mini App.
- **Estilo MapleStory (lateral).** Todos los sprites que ya existen son de
  vista lateral: el duende animado, las 7 skins, las 19 criaturas, los 2
  jefes con hoja, los fondos CC0 de los 5 biomas y los efectos de corte se
  reutilizan TAL CUAL. Cero assets nuevos → nada nuevo que licenciar.
- **Servidor: un Durable Object de Cloudflare** (`functions/mmo/world.js`,
  clase `MmoWorld`, binding `MMO` en `wrangler.toml`, migración
  `v1-mmo` con `new_sqlite_classes`: el plan gratuito solo admite DO con
  SQLite). Mismo Worker, mismo deploy por `git push`, sin hosting nuevo.
  Todo el mundo vive en UNA instancia (`idFromName('mundo-1')`): a esta
  escala es lo más simple; los mensajes ya van filtrados por mapa por si hay
  que partirlo. Límites del plan gratis: 100k req/día (los mensajes WS
  entrantes cuentan 20:1) y 13.000 GB-s/día (≈28 h de servidor activo con
  jugadores conectados); el bucle se apaga solo cuando no queda nadie.
- **Autoritativo en el servidor**: vida, daño, oro, XP, compras, monstruos,
  misiones. El cliente manda intenciones y su posición (validada contra la
  velocidad máxima; si se teletransporta, `snap`).
- **Identidad**: `initData` de Telegram (HMAC, reutiliza `verifyInitData`),
  sesión de Supabase en la web (`verifySupabaseUser`), o invitado con un
  token secreto de 32 hex en localStorage (el servidor guarda solo su
  SHA-256). Misma cuenta en otra pestaña → la vieja se cierra.
- **Economía aparte**: oro del MMO, NO canjeable por $DUENDE ni dinero
  (evita sumar exposición legal, ver memoria `token-reality-and-constraints`).
  Las skins pagadas con dinero real en el juego principal
  (`skin_purchases` por telegram_id o por wallet_solana del perfil web) se
  desbloquean solas en el MMO.

**Contenido:**
- Pueblo Duende (zona segura): Mercader Grumo (tienda), Guardia Tito
  (misiones), Sabio Hechicero (ranking), 5 portales.
- 5 zonas (Bosque Nocturno 1-6, Colinas Rojas 6-12, Selva Esmeralda 12-18,
  Picos Tormenta 18-24, Desierto Dorado 24-32) con el bestiario de su bioma,
  ordenado de menor a mayor nivel desde la entrada. Un jefe por zona
  (Sabueso Infernal, Rey Goblin Caballero, Señor de la Guerra, Ghoul
  Infernal, Ángel Caído) que reaparece cada 5 min; la recompensa se reparte
  por daño con mínimo un tercio por participante.
- Las 4 armas del arcade (Katana/Dagas/Odachi/Chispa, mismo reparto de
  daño/s) y los 4 poderes (Poción/Escudo/Rayo/Fuego) con los mismos
  efectos; las 7 skins con sus mismas ventajas (oro extra, robo de vida,
  vida, ataque, aura que quema).
- Cadena de 20 misiones (4 por zona, cerrando con su jefe).
- Nivel máximo 40, regeneración fuera de combate, castigo de muerte suave
  (5% XP del nivel). Monstruos normales pasivos (solo persiguen si les
  pegas); los jefes cazan.
- Chat de mapa (con límite), ranking, minimapa, jugadores en línea,
  controles táctiles en 2 filas para móvil vertical, botón Atrás de
  Telegram.
- Accesos: bot (`/start` y `/mmo`), menú del arcade web, hub de la Mini App
  (pasa el hash con `tgWebAppData`), botón en la landing.

**Cómo probar (IMPORTANTE):**
- `wrangler dev` **no puede correr Durable Objects en esta máquina**: todo
  lo que usa SQLite local da "internal error" (probado hasta con un DO
  mínimo, con y sin sandbox, fecha de compatibilidad vieja y nueva). No es
  el código. La lógica del servidor se prueba con un arnés en Node que
  importa el `world.js` real con almacenamiento y sockets falsos y un reloj
  controlado (70 comprobaciones: combate, cooldowns, niveles, poderes, jefe
  en grupo, tienda, misiones, muerte, persistencia, sesión duplicada, flood,
  ids `__proto__`). La integración real se prueba en producción con un
  cliente WebSocket de Node y el navegador.
- **Cada cambio del cliente**: subir juntos el `?v=` de
  `<script src="/mmo/js/client.js?v=N">` en `mmo/index.html` y el de
  `import ... from './data.js?v=N'` en `client.js`. Si no, durante un
  despliegue un HTML nuevo puede quedarse con un JS viejo de caché (ya pasó:
  la página se quedó en "Cargando el mundo").

**Bugs encontrados y corregidos en el camino:** comprar `__proto__`/
`constructor` dejaba el oro en NaN (ahora `Object.hasOwn`); un nivel 1
moría en 14 s en la primera zona (balance rehecho); cerrar la pestaña al
estar por morir te devolvía con vida llena (ahora se guardan vida y
muerte); costura vertical entre mosaicos del fondo; layout vertical con
franjas vacías y el botón de ataque fuera de pantalla.

**Siguientes ideas (no hechas):** grupos/party con XP compartida, comercio
entre jugadores, más mapas (castillo con goblin_lord como jefe), misiones
diarias repetibles, sonido propio para jefes.

### DUENDE QUEST ONLINE — segunda ronda (30-sep-2026, misma noche)

- **Jefes vencibles en solitario.** Con 2 jugadores reales las misiones de
  jefe se hacen solos. Simulado con el `world.js` real (script de
  simulación: un jugador pegado al jefe, poción bajo 40% de vida, con y sin
  saltar las embestidas): roce del jefe 0,7x ataque cada 1,25 s, embestida
  avisada 2,4x. Resultado: al nivel máximo recomendado de cada zona se gana
  en 25-50 s con 2-9 pociones; el Ángel final ~85%.
- **Caza cooperativa**: quien esté a <500 px cuando cae un monstruo gana el
  25% de su XP aunque no le haya pegado.
- **Misión diaria** "Caza del día" (25 monstruos de tu nivel o hasta 5 por
  debajo, se cobra una vez por día UTC con el Guardia Tito).
- **Monstruos a distancia**: hechicero, goblin mago, Ghoul Infernal y Ángel
  lanzan bolas de fuego (los jefes en abanico de 3). El servidor las mueve y
  decide el impacto; se esquivan saltando.
- **Volver al pueblo** (R o 🌀) desde cualquier zona, solo fuera de combate
  (8 s sin recibir golpes).
- **Inactividad**: el servidor desconecta tras 10 min sin actividad y el
  cliente suelta la conexión si la pestaña queda oculta 3 min (reconecta al
  volver). Sin esto, UNA pestaña abierta casi agotaba el cupo diario gratis
  de CPU de Durable Objects (13.000 GB-s).
- **Física a paso fijo de 60 Hz** en el cliente: antes iba por fotograma
  (al doble en pantallas de 120/144 Hz, en cámara lenta con pestaña lenta).
- Chat global con etiqueta de mapa, ❗ sobre el Guardia con misión lista,
  nombre de monstruo al herirlo, fundido de portal, más monstruos con más
  jugadores en la zona, etiquetas de portales en 2 líneas.
- **Banner para compartir** `assets/mmo_banner.png` (Open Graph en /mmo/),
  generado por `tools/generar_banner_mmo.py` con sprites/fondos existentes;
  `mmo/manifest.json` para instalar el MMO aparte.
- **Ranking limpio de pruebas**: migración única `mig:ranking-pruebas` que
  sacó a los personajes de las verificaciones, y `UIDS_PRUEBA` en
  `world.js` con los tokens fijos de los bots de prueba (`'8'.repeat(32)` y
  `'9'.repeat(32)`): pueden jugar en producción sin salir en el ranking. Si
  se crean más bots de prueba, usar esos tokens.
- Arnés: 84 comprobaciones (misiones, diaria, proyectiles, regreso,
  inactividad, chat global…).
- **Territorio de jefes**: la prueba de resistencia en producción (4 min de
  caza con un bot: 0 desconexiones, 0 errores, 10,3 fotos/s) mostró que el
  Sabueso (Nv 8) cazaba a 700 px y llegaba a la entrada del Bosque, donde
  están los nivel 1. Ahora cada jefe solo persigue a quien entre a 520 px de
  su guarida, no se le puede arrastrar a más de 600 px, y vuelve a casa si
  no hay nadie.
- **Invitado → cuenta**: si alguien juega como invitado y luego entra con su
  cuenta web o de Telegram (sin personaje todavía), hereda el personaje del
  invitado; el de invitado se borra y su fila del ranking pasa a la cuenta.
- **Forja** en el Mercader: cada arma de +0 a +10 con oro (+7% de daño por
  nivel, costo 150×1,7ⁿ, ~42k de oro hasta +10). Sin azar a propósito: cada
  mejora sale siempre bien (nada de mecánicas tipo apuesta).
- Arnés: 97 comprobaciones.
- **Sexta zona, final de juego: Castillo del Rey Goblin (Nv 32-40)**. El
  tope es Nv 40 y el Desierto acababa en 32: de 32 a 40 no había dónde
  jugar. Fondo del pack de castillo ya usado (`tormenta2`), 4 monstruos de
  élite Nv 33-38 (hojas del bestiario con tintes de la corte), jefe **Rey
  Goblin** Nv 42 (el `goblin_lord` que se había reservado para un bioma
  castillo; `tools/generar_goblin_lord_cc0.py`), 4 misiones más (la cadena
  pasa a 24). Portales: desde el Desierto y desde el pueblo. Simulado: el
  Rey se vence en solitario a Nv 40 en ~41-45 s con ~7 pociones.

### DUENDE QUEST ONLINE — gran expansión (2-oct-2026)

- **Tope Nv 60 y 4 zonas nuevas** (cadena desde el Castillo y portales en el
  pueblo, que pasa a 3300 px): Cumbres del Ocaso (40-45, jefe Coloso de
  Hueso), Cavernas Abisales (45-50, Rey Cangrejo), Abismo Marino (50-55,
  Leviatán) y Acantilados Mágicos (55-60, **Dragón Ancestral**). 18 monstruos
  nuevos y 16 misiones más (la cadena pasa a 40). Arte de ansimuz/Ashuuya,
  ver CREDITOS.md (dos packs son **CC-BY: el crédito es obligatorio** y está
  también en la ayuda del MMO). Hojas y fondos: `tools/generar_mmo_expansion_cc0.py`.
- `HOJAS[k].izq = 1` marca los dibujos que miran a la izquierda (el
  Sabueso Infernal caminaba de espaldas desde siempre).
- **Equipo**: casco, armadura, botas, anillo y amuleto; 4 rarezas; lo suelta
  el 6% de los monstruos de tu nivel (o hasta 10 por debajo) y los jefes
  siempre (raro+). Bolsa de 40 (si se llena, lo nuevo se vende solo). Nunca se
  compra: nada de cajas de pago. Un legendario se anuncia a todo el servidor.
- **Habilidades** por nivel: Torbellino (10), Estocada (20), Meteoros (30),
  Furia (45). Teclas C V B N; en móvil, fila propia encima de los poderes.
- **Recompensa diaria** con racha de 7 días (el 7º da un objeto épico).
- **Logros (16) y títulos** sobre el nombre.
- **Jefe mundial** cada 30 min (:00 y :30 UTC) en el Coliseo (portal 👹 del
  pueblo): vida 20.000 + 15.000 por conectado, pega un % de la vida de cada
  uno (4% roce, 6% bola, 15% embestida) para que todos los niveles peleen
  juntos; todos los que le pegan reciben XP, oro y un objeto raro+. Escapa a
  los 10 min.
- Prueba: arnés de 44 comprobaciones con el `world.js` real y un servidor
  local en Node (WebSocket a mano, sin librerías) que sirve el juego completo
  en el navegador — `wrangler dev` sigue sin poder con Durable Objects aquí.

### DUENDE QUEST ONLINE — play to earn con mTON (2-oct-2026)

Decisiones del dueño: retiro mínimo **5 TON**, aprobación **manual**, fondo
diario = **% de ingresos**, y la web también cobra en TON (Phantom no recibe TON).

- **mTON** (1.000 = 1 TON) vive en el personaje del Durable Object (`c.mton`).
  Solo lo dan: jefes de zona (si hiciste ≥10% del daño), jefe mundial (≥2%) y
  la caza del día. Nada pagado (skins, Stars) aumenta lo que se gana.
- **Quién gana:** cuenta de Telegram o web (no invitados ni `UIDS_PRUEBA`),
  Nv 15+, personaje con 48 h. Tope por jugador: 25% del fondo del día.
- **Fondo diario** (`fondo` en el storage del DO): `auto` lo pone el cron de
  medianoche UTC (`mmoFondo` en `functions/api/cron.js`: 30% de lo que entró en
  7 días por `ton_credits` + `stars_purchases` pasado a TON con el precio de
  CoinGecko, dividido entre 7) y `extra` lo pone el dueño con **/fondo 0.5** en
  el bot. **Sin ingresos y sin /fondo, el fondo es 0 y nadie gana mTON.**
- **Wallet TON** con TON Connect (se carga al abrir 💎), única por cuenta
  (`w:<addr>` en el storage) y fija 72 h antes de poder retirar.
- **Retiros:** descuentan el saldo, quedan en `retiros` (storage del DO) y el
  bot avisa al ADMIN_TG_ID. Comandos del dueño: **/retiros**, **/pagado CODIGO**
  (avisa al jugador por Telegram), **/rechazar CODIGO** (devuelve los mTON) y
  **/rechazar CODIGO trampa** (no los devuelve). El pago se hace a mano desde la
  wallet del dueño. Rutas internas del DO: `/interno/*` con cabecera
  `x-interno = TELEGRAM_BOT_TOKEN`; el Worker solo expone `/mmo/ws`.
- Arnés de 31 comprobaciones del dinero (`arnes_mton.mjs`) + el de 44.

### DUENDE QUEST ONLINE — tienda premium manual y economía (2-oct-2026)

Pedido del dueño: que entren depósitos grandes y salgan retiros chicos, con
compras por Stars y SOL a su cuenta, todo manual y transparente (3 jugadores).

- **Con dinero se compran cosas del juego (oro y poderes), NUNCA mTON.** Si
  se pudiera comprar mTON y retirarlo en TON, el juego sería un exchange (PSAV)
  y "depositar mucho para retirar poco" sería captar fondos. Así, lo que entra
  sostiene el fondo (30% de los ingresos) y los retiros siempre son menores.
- Paquetes en `PAQUETES` (data.js): $1, $3, $5, $20 → oro / kit de poderes.
  Stars = usd / 0,013 (igual que las skins del bot). Stars solo en Telegram;
  SOL solo en la web (Telegram no permite otras cadenas en Mini Apps).
- **Stars:** el DO crea la factura (`createInvoiceLink`, payload `{mmo: código}`);
  el bot valida en `pre_checkout_query` que el pedido siga abierto, registra el
  pago en `stars_purchases` (cuenta para el fondo) y avisa al dueño.
- **SOL:** monto con 4 cifras finales propias del pedido, a `SOL_DEV_WALLET`;
  Phantom en un toque o cualquier wallet + pegar la firma. El DO mira la
  transacción en la cadena (Helius si hay clave) y le pasa al dueño el
  resultado + enlace de Solscan. Una firma no sirve para dos pedidos.
- **Entrega manual:** /pedidos, /entregar CODIGO, /anular CODIGO motivo (las
  Stars se devuelven solas con `refundStarPayment`; el SOL lo devuelve el dueño).
  Los SOL entregados se guardan en `ingresosSol` del DO y se suman al fondo.
- **Retiros más chicos:** máximo 10 TON por retiro, uno cada 7 días, y ningún
  jugador se lleva más del 20% del fondo del día. Premio del jefe mundial fijo
  (no depende del daño, para que una skin pagada no dé más mTON).
- **Transparencia** en la ventana 💎: fórmula del fondo y total pagado a
  jugadores; cada jugador ve el estado de sus compras y retiros.
- Arnés: 54 comprobaciones del dinero/tienda + 44 del juego.

### DUENDE QUEST ONLINE — sistemas de World of Warcraft (21-oct-2026)

Pedido del dueño: "que sea como WoW para navegador y Telegram". Se le
preguntó 2D o 3D y eligió **mantener el mundo 2D y añadir los sistemas de
WoW** (los personajes, el arte y el dinero no se tocan). El servidor se partió
en módulos que se mezclan en `MmoWorld` con `Object.assign` (al final de
`world.js`):

- `functions/mmo/combate.js` — **clases** (Guerrero/Ira, Mago/Maná,
  Sacerdote/Maná, Pícaro/Energía + combos), 7-8 habilidades por clase en
  `HABS` (data.js) con GCD de 1 s, tiempos de lanzamiento que se cancelan al
  moverse, recargas, **objetivo** (el cliente manda `tg`; sin objetivo se
  elige el enemigo más cercano), **amenaza** (`o.amen`: los monstruos van por
  quien más los enfureció; el guerrero genera ×2 y tiene Provocar; curar
  enfurece), **auras** (escudos, curas en el tiempo, raíz, aturdir, oveja,
  silencio...), **interrupciones** (Patada, Zurrar, Contrahechizo, Silencio;
  solo cortan hechizos con barra naranja = `int`), resurrección del
  sacerdote, Piedra de Hogar (6 s quieto), **especializaciones** (2 por clase
  desde Nv 10, `ESPECS`) y **monturas** (`MONTURAS`, Mercader, tecla Y,
  ×1,5-×2 de velocidad; atacar o recibir un golpe te baja).
  Los monstruos del mundo abierto siguen pasivos, pero ahora solo pegan a su
  objetivo (antes rozar a uno pasivo hacía daño).
- `functions/mmo/social.js` — **grupos** de 5 (por uid, sobreviven a una
  reconexión, se disuelven en un despliegue), XP/oro/misión compartidos con
  +10% por miembro, **chat por canales** (general, /d decir, /g grupo,
  /h hermandad, /s susurro, /r), lista de jugadores en línea. A los clientes
  solo llega `pub(uid)` (hash FNV): el uid real es "tg:<id de Telegram>".
- `functions/mmo/mazmorras.js` — **3 mazmorras instanciadas** (Catacumbas
  Nv 10-30, Templo Hundido 30-48, Ciudadela del Dragón 45-60; `MAZMORRAS`):
  copia privada por grupo (clave de mundo `mapa#id`, `s.k`/`o.cl`), packs
  agresivos enlazados, 3 jefes con **guion** (zonas en el suelo en % de la
  vida, hechizos interrumpibles, esbirros, enfurecer, caparazón), barreras que
  abre cada jefe, revivir en la entrada, reinicio si todos caen, premio del
  día (XP + oro + épico). Nivel = el del más alto (dentro del tramo) y la vida
  de los jefes según los vivos al empezar (`escalaMazmorra`).
- `functions/mmo/hermandades.js` — **hermandades** guardadas en el storage del
  DO (`h:<id>`, `hn:<nombre>`), rangos líder/oficial/miembro, mensaje del día,
  chat /h, nombre bajo el personaje. Fundar: Nv 10 y 5.000 oro.

Cliente: marcos de jugador/objetivo/grupo con auras y barras de recurso,
barra de acción (1-8 + consumibles Q F G T + 🐎), barra de lanzamiento,
errores en rojo y avisos de jefe en naranja, ventanas de clase, libro de
hechizos (P), social (O), buscador de mazmorras (portal dorado del pueblo),
mapa del mundo (M). En PC la barra va en una franja bajo el lienzo; en
móvil, en las filas táctiles. **?v= va en 27** (subir los dos juntos).

**Dinero (sin cambios de política):** las mazmorras, grupos y hermandades
NO dan mTON (`!o.mazmorra` en `darMton`). Curar cuenta para repartir XP y oro
(`o.cura`, aparte), pero el mTON y la caza del día siguen saliendo solo de lo
propio: el daño hecho (`o.dano`) y, en la diaria, haber peleado o curado de
verdad (un compañero quieto en el grupo no la avanza). Un escudo solo cuenta
por lo que absorbe.

**Revisión independiente (agente):** encontró y se arreglaron: crear
mazmorras sin límite tumbaba el DO por memoria (ahora una instancia por
jugador/grupo que se reutiliza, 8 por hora y 40 en total), saltarse el GCD
con Piedra de Hogar + cancelar, cambiar de clase en combate para reiniciar
recargas, la Carga cruzando barreras, aturdir no cortaba lanzamientos, y
`pub()` lleva sal al azar por arranque. Arnés: 103 comprobaciones.

**Cómo probar (todo en `tools/`, que no se publica):**
- `node tools/mmo_local.mjs` — servidor local con el `world.js` real
  (WebSocket a mano) en http://localhost:8787/mmo/; config `mmo-local` en
  `.claude/launch.json`. `/__dev?js=...` ejecuta código sobre el mundo
  (`jug('Nombre')` da su sesión) para preparar pruebas. Solo local.
- `node tools/arnes_mmo.mjs` — 103 comprobaciones del servidor (clases,
  amenaza, curas, grupos, mazmorras, especializaciones, monturas).
- `node tools/sim_mazmorra.mjs [mazmorra] [nivel] [completa]` — bots de cada
  clase contra los jefes (o la mazmorra entera), solo y en grupo. Con los
  números actuales: solo ~20-55 s por jefe, en grupo de 3 ~40-58 s, y los 15
  recorridos completos (5 composiciones × 3 mazmorras) terminan.
- `tools/cdp.mjs` — Chrome sin ventana por el protocolo de DevTools (sin
  librerías) para capturas en PC y móvil. El panel de navegador de Claude
  suele estar oculto y sus capturas salen viejas: usar esto.

**Ideas siguientes (no hechas):** duelos/PvP, más mazmorras y una banda de 10,
casa de subastas o comercio entre jugadores, profesiones, talentos con
puntos. Con 2-3 jugadores reales, lo que más rinde es que se jueguen las
mazmorras en grupo.

### DUENDE QUEST ONLINE — retención medida y avisos de vuelta (21-oct-2026)

Módulo nuevo `functions/mmo/retencion.js` (mezclado en `MmoWorld`). En
`world.js` solo hay ganchos: `retEntrar` en `hola` (sin await),
`retAlGuardar` en `guardar` (cubre el guardado periódico y el cierre),
`internoRetencion` en `interno` y el `Object.assign` del final.

- **Por personaje** (`c.ret`): últimos 60 días UTC jugados (`d`, número de
  día), días distintos (`dt`), sesiones, minutos jugados (solo hasta 1 min
  después de la última acción: una pestaña olvidada no suma), última vez
  visto y si se contó como alta. Primera vez = `c.creado`; nivel = `c.nivel`.
- **Agregados** en el storage del DO: `ret:dia:<YYYY-MM-DD>` = `{ n altas, a
  activos, ses, min, r1, r7, r30 }` (rN = de las altas de ese día, cuántos
  volvieron exactamente N días después) y `ret:idx` = `{ uid: { v último día,
  l nivel, a avisos sin respuesta, ad día del último aviso, off, bloq } }`.
  No se lista ningún `c:<uid>`. Los `UIDS_PRUEBA` no cuentan.
- **Solo cuentan como altas los personajes creados desde este despliegue**:
  los que ya existían no tienen día de alta fiable. D1/D7/D30 empiezan a
  tener datos 2, 8 y 31 días después de desplegar; los activos, en cuanto
  cada jugador vuelva a entrar.
- **/mmostats** (solo ADMIN_TG_ID): activos hoy/7/30 días (por tipo de cuenta
  y tramo de nivel), altas por día, retención D1/D7/D30 de las últimas 30
  cohortes ya cumplidas, tabla de cohortes, sesión media de 7 días y top 10.
- **Avisos de vuelta** (cron de las 17:00 UTC → ruta interna
  `recordatorios`): solo cuentas `tg:` que jugaron en los últimos 14 días, no
  entraron hoy y no están conectadas; 1 al día; tras 2 sin volver se pausa
  hasta que vuelva. El texto sale de su estado: racha de login que se pierde
  hoy, grupo u hermandad conectados, premio diario de mazmorra (Nv 10+), caza
  del día y XP para el siguiente nivel/habilidad (máximo 3 líneas, texto
  plano). Botones: abrir el MMO (web_app) y "No quiero más avisos"
  (`callback_data` `mmoavisos:off`). Tandas de 25 con pausa de 1,1 s; un 429
  espera `retry_after`; un 403 marca `bloq` y no se le vuelve a escribir.
- **Un solo mensaje por persona a las 17:00**: el cron manda primero los del
  MMO y el recordatorio del arcade se salta a los avisados, a los que
  bloquearon el bot y a los que pidieron **/avisos off** (el opt-out vale
  para los dos). **/avisos on** los reactiva (y quita la marca de bloqueo).
- Arnés (`node tools/arnes_mmo.mjs`): 149 comprobaciones, 46 nuevas
  (cohortes D1/D7, minutos, cambio de día conectado, rutas internas con
  clave, opt-out, pausa, bloqueo, ventana de 14 días y el cron completo con
  `fetch` simulado). Entra con cuentas `tg:` firmando el initData como
  Telegram. El envío es `tgEnviar` y la pausa `dormir`: las pruebas los cambian.

### DUENDE QUEST ONLINE — mundo abierto: invasiones, raros y cofres (21-oct-2026)

Todo en `functions/mmo/eventos.js` (mixin `Eventos`); en el cliente, la
sección "MUNDO ABIERTO" de `client.js`. Solo zonas abiertas con monstruos
(nunca pueblo, Coliseo ni mazmorras). **Nada de esto da mTON.**

- **Invasiones**: cada 12-15 min, en una zona abierta elegida al azar entre
  las que tienen gente; aviso a todo el servidor. Oleadas de invasores
  agresivos (cada 6 s, cerca de los jugadores, del nivel medio de los
  presentes dentro del tramo de la zona) y, al cumplir la meta (20 en
  solitario, +8 por jugador, tope 60), un **Capitán** élite (12× vida, más
  por jugador). Al caer, todos los que pegaron o curaron a algún invasor
  (por uid) cobran XP, oro y un objeto raro+ con el nivel de la zona. A los
  5 min sin terminar, se retiran y no hay premio. Panel en `#h-evento`
  (nombre, reloj, progreso) para todos; el minimapa se enciende en la zona.
- **Élites raros**: en cada zona con gente, una tirada por minuto (12%) a
  partir de 3-8 min; nombre propio, tinte dorado/plateado, 6× vida, "★ Raro".
  Aviso solo a la zona; uno vivo como mucho; tras morir, 20 min sin otro.
  Suelta a cada participante un objeto raro+ y XP/oro extra.
- **Cofres**: 3 por zona en sitios fijos (legendario en la plataforma más
  alta, épico en la más lejana a esa, común al fondo del mapa). Las
  posiciones las manda el servidor (`{t:'cofres'}` al entrar a un mapa), no
  están en data.js. Cada jugador abre cada cofre una vez cada 30 min (marca en
  `c.cofres`, guardada al momento); el servidor valida la distancia (70 px) y
  que no esté abierto. Oro según el nivel de la zona, a veces pociones y, con
  poca probabilidad, equipo. Tecla E o el botón de acción.
- Ganchos en `world.js`: import + `Object.assign`, `case 'cofre'`,
  `eventosAlEntrar` en `entrarMapa`, `tickEventos` en `tick`,
  `alMorirEspecial` en `matar`, `ex` en `infoMonstruo` y en las opciones de
  `crearMonstruo`.
- Arnés: 155 comprobaciones (52 nuevas). Se arregló además una falla al azar
  del arnés: `entrar()` esperaba el login con 20 vueltas de setImmediate y el
  SHA-256 a veces tardaba más (ahora espera por tiempo real).
- No se subió el `?v=` (sigue en 27): súbelo con el siguiente cambio del cliente.

### DUENDE QUEST ONLINE — retención y mundo abierto (21-oct-2026, segunda parte)

El dueño pidió "publícalo, mundo abierto, perfecto, 100% de retención" y
"mejora continuamente hasta acabar la sesión y pasa a otra haciendo lo
mismo". Publicado en varias tandas (cliente ?v=30). Además de lo de los
agentes (avisos de Telegram + estadísticas `/mmostats`, invasiones/raros/
cofres, ver sus apartados), se hizo:

- **Guía del jugador nuevo:** flecha amarilla hacia el siguiente paso de la
  misión (busca la ruta de portales entre zonas), tutorial de 5 consejos
  (`#consejo`, se guarda por personaje en localStorage), viaje caminando
  contra el borde de la zona (hay que soltar la tecla tras cada viaje; no en
  mazmorras).
- **XP de descanso** (`c.descanso`, `c.salida`): 8% de tu nivel por hora
  fuera (desde 1 h), tope 1,5 niveles; duplica la XP de las cazas. Azul en
  la barra de XP.
- **Misiones diarias (3) y semanales (2)** en `functions/mmo/tareas.js`,
  elegidas por hash de uid+fecha, se cobran solas, bono por completarlas.
  Tecla L = registro de misiones.
- **Ranking semanal** de XP ganada (`rankSem` en el storage, en memoria y
  volcado cada minuto). Al cambiar la semana premia al top 3 (oro × nivel,
  objeto, título Campeón Semanal) y avisa por Telegram (respetando /avisos).
- **Recolección y artesanía** (`functions/mmo/profesiones.js`): 4 nodos por
  zona, Artesana Lila (pueblo x=1680) con pociones, escudos, pólvora,
  refinar cristal y elixires de 30 min (`c.elix`, aguantan la muerte).
- **Talentos**: 1 punto por nivel desde el 10, 10 talentos × 5 rangos (📖).
- **Bestiario** (`c.best`): hitos 25/100/300 por tipo de monstruo con oro.
- **Invita a un amigo** (`functions/mmo/amigos.js`): enlace
  `t.me/duendequest_bot?start=mmo_<código>` (el bot responde con el MMO y
  `?ref=`) o `/mmo/?ref=<código>`. Premio para los dos cuando el amigo llega
  a Nv 10 (solo cuentas reales y personajes nuevos); al 5º, montura.
- Resumen de muerte con consejo, frases rápidas en el chat del móvil,
  "equipar lo mejor", ataque automático (🔁 / tecla H), textos del lienzo en
  caché (`spriteTexto`).
- **Arreglo importante (segunda revisión):** dos `hola` simultáneos de la
  misma cuenta creaban dos copias del personaje (se podía duplicar mTON).
  Ahora `this.entrando` reserva el uid durante el login.

Ninguna de estas cosas da mTON. Arnés: 234 comprobaciones.

**Medición de rendimiento:** repetida el 22-oct con la máquina libre (CPU
al 6%): combate cargado con 14 monstruos a 60 FPS (p95 17 ms) a velocidad
normal y 55 FPS (p95 33 ms) con la CPU 4× más lenta (Chrome sin ventana, sin
GPU). Los 20-28 FPS de antes eran por la carga de los agentes. Falta probar
en un teléfono real.

**Duelos** (`functions/mmo/duelos.js`, cliente ?v=31): botón ⚔️ en el
marco de otro jugador → reto de 30 s → cuenta atrás de 3 s → 90 s de pelea
con ataque básico y habilidades de daño (`tk:'p'` en `atk`/`hab`). Nadie
muere: quien queda a 1 de vida pierde; al acabar ambos quedan con ≥30% de
vida. Termina también por tiempo (gana quien tenga más % de vida), por
alejarse 900 px, cambiar de mapa o desconectarse. Daño reducido (×0,12 golpe,
×0,2 vara; la defensa solo amortigua) para ~20-40 s a igual nivel. Logro
"Duelista" (10 victorias, `c.duelosG`). Ni oro ni mTON por ganar.

**Auditoría del jugador nuevo (agente, 21-oct) y arreglos (?v=32):** un bot
que seguía la flecha moría 75-94 veces en 40 min y no pasaba de Nv 2-5
(sin esas trampas llegaba a Nv 10 en ~9 min). Causas y arreglos:
- El Sabueso (Nv 8) tenía la guarida en mitad del Bosque (x 1612): ahora
  `MAPAS.noche.jefeX = 2330` y los jefes de zona no persiguen a quien está
  3+ niveles por debajo (salvo que les pegue).
- La zona se taponaba con tipos que el novato no mata (fantasmas, hechiceros):
  `tipoAReponer` limita cada tipo a su parte del cupo y saca el doble del
  tipo de las misiones de los presentes; con la zona llena se retira cada
  20 s un monstruo que nadie tocó en 3 min (`md` con `fuera:1`).
- Morir antes de Nv 10: sin perder XP y a la entrada de la misma zona.
- La racha diaria la tapaba la ventana de clase: ahora sale tras elegirla;
  faltar UN día retrocede dos en vez de reiniciarla.
- Móvil: descripciones de clase, seguimiento a 8 px (7 en estrecho), avisos
  más abajo, solo la siguiente habilidad bloqueada, aparición fuera del
  Mercader (pueblo x=720).
Además se validó la altura en `mover` (`techoEn`: doble salto ≈183 px,
tope 215 sobre el suelo o una plataforma cercana).

Segunda tanda (?v=33):
- `tools/sim_jefe_solo.mjs`: todos los jefes de zona se vencen SOLO con
  cualquier clase incluso 4 niveles por debajo (9-29 s); las misiones de
  jefe no bloquean (las muertes del informe eran de Nv 1-3 quietos).
- Telegram: `requestWriteAccess` al llegar a Nv 3 y `addToHomeScreen` a Nv 5
  (una vez por dispositivo; `permisosTg` en client.js).
- Reconectar dentro de una mazmorra abierta te devuelve a ella
  (`volverAInstancia`); una vacía aguanta 5 min; con la pestaña oculta en
  una mazmorra la desconexión es a los 8 min (3 fuera).
- mTON: aviso claro en 💎 cuando el fondo del día está vacío; el toast de
  Nv 15 y la bienvenida del bot dicen "los días que hay fondo".
**Desafíos de mazmorra (final de juego, ?v=34):** a Nv 60, en el buscador
cada mazmorra tiene "⚡ DESAFÍO +k": la mazmorra a Nv 60 con vida ×(1+0,2k) y
daño ×(1+0,1k) (`multDesafio`, `w.inst.k/mv/ma`, también en `empezarJefe` y
los esbirros). Vencer el +k abre el +k+1 (`c.desafio[id]`, `c.desafioMax`),
da 500·(k+4) de oro y un objeto de nivel 60+k (`it.des`, se equipa a Nv 60;
épico garantizado desde +10). Logros +5/+10/+20. Tope +30. Sin mTON (los
jefes de mazmorra nunca dan). Simulación sin equipo
(`node tools/sim_mazmorra.mjs ciudadela 0,3,6,10 desafio`): guerrero solo
hasta +3, grupo de 3 hasta +10 en ~9 min; con equipo se llega más lejos.

**Temporada "Noche de Duendes" (?v=35):** del 25-oct al 2-nov-2026 (UTC,
`TEMPORADA` en data.js; para otra fecha basta cambiar `id/nombre/ini/fin`).
Cada caza con participación da 20% de una 🎃 (jefes, 5); `c.calabazas`;
logros con título a 50 y 200. Calabazas decorando el suelo de cada mapa y
contador en el seguimiento. Aviso al entrar. Solo oro y títulos.
Además: "N hoy" junto a "en línea" (jugadores distintos del día, del índice
de retención, cada 10 s con el mensaje `on`).

**Tercera revisión (agente, 22-oct) y arreglos (?v=36):**
- ALTA: el duelo curaba la vida al máximo al empezar (y al 30% al acabar):
  retarse servía de cura infinita contra jefes. Ya no cura nada; hay que
  llevar 5 s fuera de combate para retar y aceptar; nunca en mazmorras ni en
  el Coliseo (se vuelve a mirar al aceptar); 10 s entre retos a la misma
  persona; `dueloFin` llega a los dos aunque estén en mapas distintos.
- En duelo, Ejecutar exige rival bajo el 25% y tras un aturdimiento el
  rival es inmune 4 s (Polimorfia en cadena).
- Reconectar solo devuelve a TU instancia (`c.inst`) y con nivel para ella
  (antes se podía caer en el Desafío de otro a Nv 20).
- Un Nv 60 del grupo entra a la mazmorra/Desafío abierto del grupo aunque no
  haya vencido ese +k; quien va llevado avanza de uno en uno; el premio del
  Desafío es al batir tu marca o una vez al día por mazmorra (`c.desDia`).
- Racha: tras el día 7, faltar vuelve al 1 (si no, se cobraba el 7 cada 3).
- `techoEn` con margen ±380 (salto con dash y montura daba falsos positivos).
- Novato que cierra el juego muerto: mismo trato que al revivir.

**Calendario de temporadas (?v=37):** `TEMPORADAS` en data.js es una
lista y se encienden solas por fecha (`temporadaDe`): Noche de Duendes
(25-oct a 2-nov, 🎃 → `c.calabazas`) y Navidad Duende (18-dic a 6-ene, 🎁 →
`c.regalos`, adorno 🎄, títulos «Duende Navideño» y «Santa Duende»). Para
una nueva: añadirla a la lista con su `campo`, sus dos logros en LOGROS y
el campo en `datosPropios`. Además, vibración de Telegram (`vibrar`) al
subir de nivel, ganar un logro y terminar un duelo.

**Botón 📣 PRESUMIR (?v=38):** 12 s tras un logro, una mazmorra completada
o un legendario. Comparte el logro con TU enlace de invitación (Telegram:
t.me/share; web: `navigator.share` o, si falla, copia texto y enlace). El
enlace se pide al servidor al mostrar el botón, porque compartir tras
esperar una respuesta lo bloquea el navegador. Es la vía para traer
jugadores: sin gente, los % de retención no significan nada.

**Valle de Nv 10-30 (?v=39):** las misiones de caza 9-23 dan ×1,8 de XP
(solo daban ~20% de un nivel; ahora ~35-40%). Las de jefe, igual.

**Conjuntos de mazmorra (?v=40):** `CONJUNTOS` en data.js, uno por
mazmorra (Huesos del Guardián, Marea Hundida, Escamas del Dragón). Los jefes
de mazmorra sueltan su pieza un 45% de las veces (`it.cj`) y el premio del
Desafío siempre lo es. 2 piezas = bono pequeño, 4 = mayor (multiplicadores
en `statsJugador` vía `bonoConjuntos`). En 🎒 Equipo se ve cada conjunto
puesto con sus piezas y bonos. Arreglado además: los objetos de Desafío
(Nv 60+k) salían en rojo y sin EQUIPAR en la bolsa (`puedeUsar`).

**Colores del nombre (?v=41):** `TINTES` en data.js (Oro Duende 20k Nv10,
Esmeralda 40k Nv20, Rubí 60k Nv30, Amatista 100k Nv40, Arcoíris 500k Nv60,
este último va rotando 12 tonos). Pestaña 🎨 COLORES del Mercader
(`comprar` con k:'tinte'; id '' vuelve al color de la clase). `c.tintes`,
`c.tinte`, se ve en `infoApariencia.tn`. Solo estética: gasto de oro a largo
plazo.

**Ranking de Desafíos (?v=42):** en el Sabio Hechicero, el mejor +k de
cada uno (`rankDes` en el storage, top 30, se actualiza al batir la marca;
`actualizarRankDes`). Y el botón de la muerte dice "revivir aquí" a los
novatos (Nv < 10), que reviven en la entrada de la zona sin perder XP.

**Premio físico: chicha morada (?v=42, pedido del dueño 22-oct):**
`functions/mmo/chicha.js` + `CHICHA` en data.js. Cada caza suma puntos SIEMPRE
(1, 3 si es de tu nivel o más, 25 un jefe; no al azar para que no sea un
sorteo, que en Perú requiere autorización), desde Nv 10, solo cuentas, tope
600/día. Con 10.000 y con 50.000 puntos se reclama un litro (🎒 → 🥤 CHICHA):
hace falta Nv 15, 48 h de personaje y entrar por Telegram. El bot avisa al
dueño con el contacto (`tg://user?id=`) y él pide la dirección por privado
(el juego NO guarda direcciones). Comandos: /chicha, /chichaok CODIGO,
/chichano CODIGO motivo [trampa]. Tope `mesMax` = 10 litros al mes. Los
puntos no se compran ni se gastan. Reclamos en el storage `chichas`.
Arreglos de la cuarta revisión: «equipar lo mejor» no rompe un conjunto
activo; piezas de conjunto ya no se autovenden con la bolsa llena;
probabilidad de pieza 25%; la temporada la manda el servidor (`yo.temp`).

**Nueva medición del novato (22-oct, bot de la auditoría en móvil, mago,
servidor local con ?v=41):** 0 muertes y Nv 9 en 8 min, misión 4 (el
Sabueso) vencida y ya en las Colinas Rojas. Antes: 75 muertes en 40 min y
Nv 5. Script: `ret/jugar.mjs` en el scratchpad de la sesión (variable PJ =
puerto del servidor local).

**Diseño serio y confiable + SEO (22-oct, ?v=43):** el dueño dijo que se veía
"a estafa e inseguro". Guía común: paleta sobria (fondo #0b0f17, primario
azul #3b82f6, oro solo para recompensas), sans-serif para leer y pixel solo
en títulos, un botón principal por vista, sin brillos ni parpadeos en
dinero, textos sin hype y la frase "🔒 Nunca te pediremos contraseñas,
frases semilla ni pagos por mensaje privado." en wallet, tienda, premios y
bot. Agentes por archivo: mmo/index.html (tokens CSS nuevos, inicio, SEO),
mmo/js/client.js (vistas y textos con var(--...)), telegram/index.html,
game.html, index.html, terminos/privacidad + seguridad.html (nueva),
telegram-bot.js (textos; además mdSeguro en nombres y título de factura
≤32), robots.txt + sitemap.xml + manifest.json. Se quitaron mensajes de
"Game Over" con cifras inventadas al azar (hub y arcade). En las páginas
legales se pusieron valores prudentes que el dueño debe confirmar: titular
"su creador", envíos de chicha dentro del Perú (otros países caso por
caso), la conversación con la dirección se borra al confirmar la entrega,
y se escribe a ganadores desde @ElDuendeOficial.

**Revisión de diseño en 3 fases (22-oct, ?v=44):** 8 agentes implementaron
por archivo, 5 revisaron (móvil, PC, confianza, conversión, accesibilidad+SEO)
y 5 corrigieron por archivo. Tokens finales: --pri #2563eb (texto blanco
AA), --pri2 #1d4ed8, --pri-txt #60a5fa (azul para TEXTO sobre oscuro),
--txt3 #8a93a6. Cloudflare sirve las páginas sin .html (/game, /seguridad,
/terminos, /privacidad redirigen 307): canonical y sitemap usan esas URLs.
Decisiones del dueño (22-oct, "resuélvelo tú, te doy permiso", y luego
"deja las donaciones y la compra del token, lo manejamos manual"):
- SE MANTIENE la venta directa y manual SOL→$DUENDE (1 SOL = 10.000; el dueño
  envía los tokens a mano para no pagar APIs) y las donaciones; la sección
  "Apoya Duende Quest" de la portada se rediseñó para convertir más: compra
  directa en 3 pasos con montos rápidos y botón de conectar wallet (en móvil
  el del menú está oculto), donaciones aparte, en qué se usa el apoyo.
  También se mantiene /buy de $DUENDE con Stars en el bot. NO TOCAR sin
  que lo pida el dueño (ya se le explicó el riesgo PSAV/Telegram).
- Quitado de la portada: perks inventados de los niveles de skin (DAO,
  revenue share, torneos con premio, boosters, Discord, escasez "100 en
  total") → beneficios reales de las skins (precios en US$ de la tienda);
  tokenomics inventada (80% bloqueado, vesting) → datos verificables
  on-chain; "pozo de torneos" → ranking semanal real; armas/cofres con
  precio en SOL → objetos que se consiguen jugando.
- Fondo de mTON: FONDO_PCT (cron.js) y FONDO_PCT_INGRESOS (data.js) en 0;
  lo aporta solo el creador con /fondo, nunca lo que pagan otros jugadores.
- Términos al día: compra directa descrita (no inversión, entrega manual),
  skins con sus bonos, el fondo del creador, ninguna compra da mTON.
Sigue pendiente (no código): nombre/RUC del titular y Libro de
Reclamaciones si se vende a consumidores en Perú.

Sin hacer: avisos a la hora habitual de cada uno (el cron de las 17 UTC ya
usa 4 de 5 disparadores del plan gratis), y final de juego para D30 (1→60 se
juega en 5-8 h). Ojo: la bienvenida del bot aún habla de $DUENDE en Solana
dentro de Telegram (decisión del dueño; ver memoria de restricciones).
Metas realistas: D1 30-35%, D7 10-12%, D30 4-6% (el 100% no existe; con
menos de ~100 altas por cohorte los porcentajes no significan nada).

**Pendiente / ideas para la siguiente sesión:** ver la sección siguiente (22-oct,
tercera parte), que ya hizo buscador de grupo, más mazmorras, temporada y
avisos a la hora habitual.

### DUENDE QUEST ONLINE — final de juego, avisos a su hora y 4ª mazmorra (22-oct-2026, tercera parte)

Sesión de "mejora continua" (?v=45 → ?v=52, todo publicado y con humo OK).
Arnés: **361 comprobaciones** (`node --no-warnings tools/arnes_mmo.mjs`).
Nada de esto da mTON.

- **Afijos semanales de los Desafíos** (`AFIJOS`, `afijosSemana`, `afijosDe`,
  `multAfijos` en data.js; `afijoFurioso`, `afijoVolcanico`, `alMorirPack`
  en mazmorras.js): cambian cada lunes UTC (ciclo de 6 semanas). Primario
  desde el +2: Fortificado (packs +25% vida, +15% daño) o Tiránico (jefes
  igual). Secundario desde el +5: Furioso (bajo 30% → +50% daño), Volcánico
  (llama bajo cada jugador cada 8 s en combate, aviso 1,6 s, 12% de la
  vida; se esquiva saliendo o saltando) o Sanguinario (al morir uno, su
  pack se cura 20%). Se fijan al abrir la instancia (`w.inst.af`, `mvP/maP`
  packs, `mvJ/maJ` jefes). Simulación sin equipo: grupo de 3 vence el +10
  en ~12,5 min (antes ~9).
- **Ranking semanal de Desafíos** (`rankDesSem` en storage, `this.rds`,
  `anotarDesSem`, `premiarDesSem` desde `revisarSemana`): mejor +k
  acreditado de la semana; el lunes, top 3 desde el +5: 20.000 / 10.000 /
  5.000 oro y el 1º `c.maestroDes` → logro «Maestro de Desafíos».
- **Avisos a la hora habitual** (retencion.js): `ret:idx[uid].hs` = hora UTC
  de la primera entrada de cada día (últimas 10); `horaHabitual` = la más
  repetida (con <3 días, 17). La **alarma del Durable Object** (`alarm()`,
  cada hora en punto +30 s; se programa en `migrar` con `asegurarAlarma`)
  avisa a quien le toca; las 17:00 las sigue haciendo el cron (sin gastar
  el 5º disparador). El cron recibe `hoy` (avisados hoy + los que se avisarán
  más tarde) y el recordatorio del arcade se los salta: un mensaje al día.
  Si falla la llamada del MMO, pide `interno/avisadosHoy`; sin lista, ese día
  no sale el del arcade. Máx. 40 avisos por hora (lo que pase se pierde ese
  día; con la escala actual sobra).
- **Temporada «Cosecha del Maíz Morado»** (13-30 nov, 🌽 → `c.mazorcas`,
  títulos Cosechador / Señor del Maíz Morado). "yo" manda el contador de
  todas las temporadas de `TEMPORADAS`. Sin evento activo, al entrar se
  anuncia el siguiente si falta ≤10 días. Calendario: Noche de Duendes
  25-oct→2-nov, Cosecha 13→30-nov, Navidad 18-dic→6-ene, Carnaval Duende
  4→14-feb-2027 (🎭 → `c.mascaras`, títulos Carnavalero / Rey Momo). Falta
  algo para mediados de enero y marzo en adelante.
- **Buscador de grupo** (social.js `buscarGrupo/lfgVigentes/unirseLfg/
  quitarLfg`; cliente `pintarLfg`, aviso con tipo `lfg` en `#invitacion`):
  en el portal de mazmorras "📢 Anunciarme" (10 min; límite 1/min en
  `this.lfgT`, que quitar no reinicia). Se avisa a los conectados con nivel
  y sin grupo; "Unirme" mete al momento en el grupo (la líder expulsa si
  quiere). No se entra así a un grupo dentro de un Desafío; el aviso no tapa
  una invitación real sin contestar; se borra al desconectarse.
- **Bóveda semanal** (mazmorras.js `rotarBoveda/progresoBoveda/
  elegirBoveda`, `BOVEDA_UMBRALES` = 1/4/8): mazmorras completadas en la
  semana → 1-3 objetos para elegir UNO el lunes (nivel propio, o 60+k con
  Desafíos; épico desde +5). Rota en `datosPropios`. Si no eliges, esa
  semana se pierde. Se abre sola al entrar (espera a que se cierren otras
  ventanas) y desde el portal.
- **4ª mazmorra: Fortaleza Goblin** (Nv 20-40, `MAZMORRAS.fortaleza`, mapa
  `fortaleza` con fondo `cumbres`): jefes `mz_capataz`, `mz_chaman`,
  `mz_rey_goblin`; conjunto «Botín del Rey Goblin»; logro «Azote Goblin».
  Una mazmorra nueva es SOLO datos: MONSTRUOS (jefes con guion), MAZMORRAS,
  MAPAS (instancia), CONJUNTOS (obligatorio: el premio del Desafío usa
  `cj = id`) y opcionalmente un logro.
- **Revisión independiente (agente)**: encontró y se arreglaron 4 fallos del
  buscador y del cron (ver commit "arreglos de la revisión").

**Cómo se trabajó (útil para la siguiente):**
- Otra sesión estaba publicando en master a la vez (web, arcade, guía):
  antes de cada push `git fetch` + `git merge origin/master` (la herramienta
  `sync_with_base_branch` falló por "Committer identity unknown" en el
  equipo). Si los dos subís `?v=` a la vez, quedáis en el mismo número:
  súbelo uno más tras fusionar.
- Desde el 22-oct `worker.js` cachea 7 días los JS pedidos con `?v=`: subir
  el `?v=` (HTML + import de data.js) es OBLIGATORIO en cada cambio del
  cliente o de data.js.
- `mmo-local` tiene `autoPort` (el 8787 lo usaba otra sesión): el puerto
  sale en el resultado de preview_start. Reiniciarlo tras cambiar el
  servidor (carga world.js al arrancar).
- Con la máquina cargada (agentes corriendo pruebas a la vez) el arnés
  puede fallar al azar en el login ("Cannot set properties of null"): se
  alargó la espera en `entrarTg` y en `sim_mazmorra.mjs`; si vuelve a pasar,
  repetir antes de buscar un fallo.
- Scripts de captura de esta sesión (cdp.mjs + `/__dev`): en el scratchpad
  (`foto_afijos.mjs`, `foto_lfg.mjs` con dos jugadores, `foto_boveda.mjs`,
  `foto_fort.mjs`) y `deploy.sh <sha>` (espera Workers Builds y corre el humo).

**Hallazgos del QA de jugador (22-oct de madrugada, ?v=53 → ?v=59):** la
sesión principal lanzó un agente que jugó con Chrome sin ventana (informe y
scripts en su scratchpad `qa_gamer_mmo/`: `fps.mjs`, `h.mjs`, combate,
duelo...) y pasó los hallazgos a esta sesión. Arreglado y publicado:
- **Rendimiento móvil** (medido con su `fps.mjs`, 390×844, CPU 4× lenta, 14
  monstruos): combate **13,2 → 37 FPS**, reposo 41 → 58; en PC (1366×768,
  CPU 4×) combate 7,7 → 55 FPS. Causas: emojis con
  `fillText` en cada fotograma (ahora `emoji()` con sprite cacheado), barras
  y recargas con `width/height` (ahora `transform`, `rellenar()`),
  `querySelector` por fotograma, flecha guía con BFS cada fotograma (ahora
  `guiaActual()` cada 250 ms), burbujas medidas cada fotograma, nodos con
  `lighter`, `yo` completo tras cada golpe recibido (ya no: la vida va en la
  foto `s`). Modo `ligero` automático si la media baja de ~35 FPS.
- Lanzamientos cortados por el retroceso (`castPend`), símbolos fuera de la
  letra pixel (`FUERA_PIXEL` → letra del sistema), etiquetas mínimo 7 px en
  móvil, textos que se pisaban (números de daño sobre el nombre, barra del
  jefe, barra de lanzamiento en móvil), flecha "reaparecen aquí".
- Accesorio por clase (sombrero/aureola/capucha: todas usaban el sprite del
  guerrero), lagarto a escala, franja negra en mazmorras (cielo + fundido).
- Música: `audio/bg_music.mp3` para iPhone y carga perezosa; tonos
  sintetizados (`TONOS`/`tono()`) para lanzar, interrumpido, error, nivel,
  portal, esquiva, montar, curar. **Ojo: `bg_music.ogg` no está en
  CREDITOS.md (licencia desconocida): que el dueño confirme su origen.**
- Duelos ×2,5 de daño (~40-50 s) con marcador arriba; crítico de duelo visible;
  "¡CRÍTICO!" + retroceso del monstruo + pausa de 70 ms en tus críticos.
- Diaria del jefe mundial desde Nv 5; Bloque de Hielo avisa; consejo de
  muerte sin "tecla Q" en móvil.

**Mascotas (?v=60):** `MASCOTAS` en data.js (Hongo 15k Nv10, Rana 25k Nv15,
Zarigüeya 40k Nv20, Pájaro 70k Nv30, Murciélago 150k Nv45; usan las hojas de
monstruos en pequeño). Pestaña 🐾 MASCOTAS del Mercader (`comprar` con
k:'mascota'; id '' la guarda), `c.mascotas`/`c.mascota`, se ve en
`infoApariencia.ma`; en el cliente `dibujarMascota` (estado en `q.pet`). Solo
estética, gasto de oro a largo plazo.

**Segunda revisión (agente) y Novedades (?v=61-62):** fundido del fondo solo
en mazmorras (en mapas abiertos hacía una banda), la foto del mundo mantiene
`yo.hp/rec/combo` al día (si no, la vida del HUD volvía un instante a un valor
viejo), etiquetas con letra del sistema alineadas a la línea base (`c._by`),
barra del jefe oculta en duelo, byte NUL quitado de client.js, `entrarMapa`
con un mapa inexistente manda al pueblo (tumbaba el bucle). Ventana
**📰 Novedades** (`NOVEDADES` en data.js; subir `n` al añadir una): se abre una
vez por dispositivo a quien vuelve (no a personajes nuevos), sin pisarse con
la Bóveda (`ventanaAutoT`). El consejo del tutorial en PC baja a top:236px
(tapaba el cartel de la zona). Recorrido del novato del QA tras todo esto:
Nv 4 y 2 misiones en 70 s, sin errores.

**5ª mazmorra: Nido de la Reina Araña (?v=63):** Nv 40-58 (`MAZMORRAS.nido`,
mapa `nido` con fondo `tormenta`): jefes `mz_reina` (Lluvia de Veneno,
arañas, Capullo de Seda), `mz_liche` (Descarga de Escarcha interrumpible,
Ventisca, murciélagos) y `mz_cancerbero` (embestida, Aliento Ígneo al frente,
Aullido que aturde, enfurecer). Conjunto «Seda de la Reina», logro «Domador
del Infierno». Simulación: todas las clases solas, jefes de 19-69 s. El arnés
revisa ahora TODAS las mazmorras (mapa de instancia, conjunto, jefe final,
guion, hojas).

**Noche del 22-oct (sesión principal, web/arcade/mini app):** el dueño pidió
trabajar de 1 a 6 am solo y apagar la laptop a las 6 (`shutdown /s` programado;
se cancela con `shutdown /a`). La otra sesión llevó el MMO; esta, lo demás.
- Portada: tráiler de 30 s (`assets/video/trailer-1.mp4`, 720p, preload none,
  VideoObject), capturas reales (`assets/capturas/`, WebP + PNG), "Empieza en
  3 pasos", 8 preguntas frecuentes con FAQPage, enlaces a /guia y /novedades;
  sin el bloque base64 de 470 KB (578 → 133 KB). Sección "Apoya Duende Quest"
  (compra directa manual + donaciones, decisión del dueño: NO quitar).
- Páginas nuevas /guia y /novedades (desde data.js; en el sitemap).
- Mini app: arreglado un ReferenceError (updateLoginUI antes de tgProfile)
  que rompía login/TON/skins/Stars dentro de Telegram; ready/expand, colores,
  safe areas, BackButton, vibración, bienvenida, tarjeta de chicha morada.
- Arcade (js/engine.js, game.html, telegram): CORAZÓN ya no se pierde al
  subir de nivel, pausa táctil y automática, Web Audio con mp3 de respaldo,
  silencio (tecla M), 3-5 mejoras por etapa (teclas 1/2/3), voladores en
  picada, lienzo grande y nítido en PC, pantalla de carga.
- MMO (servidor): `tiposQueFaltan` en world.js — el tipo de la misión de un
  presente siempre aparece aunque la zona esté llena (QA: misión 1 sin
  goblins); los invasores `ex` no cuentan para el tope.
- Rendimiento: PNG sin pérdida (−120 KB) y caché en worker.js para /audio/ y
  JS con ?v= (7 días: SIEMPRE subir el ?v= al cambiar client.js/data.js).
- Bot: bienvenida y /mmo con el premio de chicha morada y 4 mazmorras.
- Video promocional: `node tools/promo/hacer_promo.mjs` (~10 min; graba juego
  real en un servidor local propio en :8796 y monta con ffmpeg; música
  original por código, SFX CC0; nunca bg_music.ogg). Salida en /promo/
  (ignorada por git y por el sitio): vertical 1080x1920, cuadrado 1080x1080 y
  portada. `--solo-montar` reusa las tomas.
- QA de jugador (MMO, arcade, mini app) y QA de regresión en producción: sin
  regresiones.
- Medición final del novato (4:20, ?v=68, bot móvil mago, 10 min): 0 muertes,
  Nv 9 a los 8,8 min, 6 misiones entregadas y ya en las Colinas Rojas.
- Segunda ronda de QA (MMO ?v=65 y web en vivo) arreglada: modo ligero con
  histéresis, buscador de grupo sin avisos en mazmorras/duelos, duelos más
  largos (la otra sesión); token sin par en DEX, compra en móvil con Phantom,
  precios de skins y objetos reales, banner y hoja de ruta al día (esta).
- Últimos de la noche: portada con "Lo nuevo" y aviso en el hero; pestañas
  Perfil/Skins/Ranking/Wallet de la mini app pulidas; arcade con 1-2 algo más
  exigente, sin fin que acelera desde la oleada 6, lienzo más alto en el
  móvil (`DQE.altoVertical`) y controles compactos en pantallas de ≤700 px
  de alto; el bot manda el tráiler (TRAILER_URL) a quien llega por primera
  vez; carrusel de 3 imágenes (`python tools/promo/carrusel.py`) y textos
  para redes en /promo/TEXTOS_PARA_REDES.txt (no se sube a git). Informes en el scratchpad de la sesión (qa_gamer_*, qa_regresion).

**Lista de amigos y Elixir de Sabiduría (?v=64-65):** `c.contactos`
[{u, n}] (máx. 50; al cliente solo `pub(uid)`), mensajes `contactoAdd` /
`contactoQuitar` / `contactos`, aviso "Tu amigo X se conectó" en `hola`
(`avisarContactos`). Botón ⭐ en el marco de otro jugador; la lista va arriba
de la pestaña En línea. Elixir de Sabiduría (+10% XP de caza, 30 min) en la
Artesana; logro «Cuidador de Bichos» (3 mascotas). Tercera revisión
(agente): aviso de "te añadió" una vez por persona y sesión, "se conectó"
solo tras 5+ min fuera (`salidaAntes`), `renombrarContacto` al heredar un
invitado. **Inspeccionar** (?v=67): botón 🔍 en el marco de otro jugador →
`inspeccionar` devuelve equipo puesto, título, hermandad, logros, mazmorras,
mejor Desafío y duelos (nada de uid, oro, mTON ni bolsa).

**QA de la tarde (sesión principal) y cierre de la noche (?v=68):** modo
ligero por tandas de 5 s con histéresis (`medirLigero`, `aditivo()` en todas
las mezclas aditivas); el aviso del buscador no salta en mazmorras/Coliseo/
duelo/combate; duelos `ESCALA` 0,16 y `ESCALA_VARA` 0,45 (el ×2,5 dejaba
guerrero contra pícaro en 11 s; falta medir con jugadores reales); `tareas`
cada 3 s como mucho; en móvil errores al 50% y emotes al 43%, chat 2 líneas;
☆/★ de amigo con estado; mascota detrás de la montura y con seguimiento por
tiempo.

**Estado al cerrar (22-oct, ~4:00):** cliente **?v=68**, arnés **393**,
5 mazmorras (Catacumbas 10-30, Fortaleza 20-40, Templo 30-48, Nido 40-58,
Ciudadela 45-60). Todo publicado con build y humo OK.

**Pendiente / ideas para la siguiente sesión:**
- Probar FPS en un teléfono real (sigue sin hacerse; en Chrome con CPU 4×
  lenta ya va a ~37 FPS en combate).
- Sprites propios por clase (ahora es un accesorio dibujado encima).
- Temporadas desde marzo de 2027 (y quizá mediados de enero).
- Más final de juego para D30: profesiones de nivel alto, cosméticos con
  oro (mascotas/monturas de oro), una banda de 10, transfiguración.
- Revisar con /mmostats los números D1/D7 (y si llegan avisos a otras horas
  que las 17: en los registros sale "[MMO avisos Nh]").
- Equilibrio de los afijos con jugadores reales (Volcánico + Tiránico puede
  ser duro en solitario).

### DUENDE QUEST ONLINE — banda, runas y gesta (22-oct-2026, cuarta parte)

Sesión de "mejora continua" (?v=68 → ?v=89, impares; los pares son de la otra
sesión). Arnés: **474 comprobaciones**. Nada de esto da mTON.

**Reparto con la otra sesión (que siguió en el MMO a la vez):** ella lleva
SKINS/PAQUETES, la tienda premium con SOL/Stars y los pedidos (world.js
`pedido`/`entregarPedido`, functions/api/telegram-bot.js y las pestañas de
skins/premium del cliente); esta, mazmorras, banda, profesiones, eventos y
equilibrio. Para no chocar con el `?v=`: **esta sesión usa los impares
(75, 77...) y la otra los pares (76, 78...)**. Avisarse por SendMessage tras
cada push.

- **Temporadas de 2027** (`TEMPORADAS`, data.js): Verano Duende 15-29 ene
  (🐚 `c.conchas`), Vendimia 4-21 mar (🍇 `c.uvas`), Lluvia de Estrellas
  15 abr-2 may (🌠 `c.estrellas`), Fiesta del Sol 12-27 jun (☀️ `c.soles`),
  Fiestas Patrias 20-31 jul (🎆 `c.fuegos`), con sus logros de 50/200. El
  arnés comprueba que van en orden, no se pisan y tienen sus dos logros.
  Falta: mayo y de agosto en adelante.
- **Monturas** Sapo Gigante (Nv 25, 15k) y Águila Real (Nv 50, 150k);
  **mascotas** Arañita, Cangrejito, Pulpito y Fantasmita (25k-200k) y logro
  «Domador de Mascotas» (8).
- **Banda: Santuario del Titán** (`MAZMORRAS.santuario`, `banda: true`,
  `dif` ×1,5 vida ×1,2 daño, mapa `santuario` de 5800 px con fondo
  `amanecer2`). Nv 60, de 1 a 10. Jefes `mz_coloso_ab`, `mz_madre_baba`,
  `mz_serafin`, `mz_titan`. Mecánica nueva: zona `junta` (`donde: 'uno'`)
  dorada que se **aguanta juntos**: golpe = dano × min(jugadores en la sala,
  3) repartido entre los de dentro; si no entra nadie, `dano` a todos.
  - Grupos: `maxGrupo(g)` = 5, o 10 con `g.banda` (botón del líder en
    Social › Grupo, mensaje `banda`; o solo al anunciarse para la banda en
    el buscador). Una banda de más de 5 no entra a mazmorras de 5 ni a
    Desafíos; tope 5/10 dentro de cada instancia (`capInst/llenaInst`);
    salir o ser expulsado del grupo te saca de la instancia
    (`sacarDeInstancia`) y `volverAInstancia` solo devuelve a la de tu grupo
    o a la tuya (`alDisolverGrupo` reparte la instancia a los miembros).
  - La vida del jefe se reescala hacia arriba si llegan más a la sala con
    el combate empezado (`o.nEsc` en `guionJefe`).
  - Botín (`botinBanda`, llamado desde `dar()`): épico Nv 64 (Titán 66, 15%
    legendario) una vez por semana y jefe (`c.bandaSem`), solo a quien pegó
    o curó y sin gastar la semana con la bolsa llena (`it.banda` se trata
    como pieza de conjunto). Conjunto «Corona del Titán». Titán vencido en
    3 semanas (`c.titanes`) → montura `abismo` (no se vende). Cuenta en la
    Bóveda como +5 una vez por semana. Logros «Azote del Titán» y «Jinete
    del Abismo».
  - Simulación (sin equipo): guerrero solo ~3 min; 3/5/10 jugadores
    5,5-6,5 min; jefes ~30 s solo y ~60-75 s con 5. El mago solo sin
    equipo no la pasa (es una banda; también le cuesta el +5 solo).
- **Artesanía de nivel alto**: en zonas Nv 30+ las plantas dan Flor de
  Luna y las vetas Mithril (`RARO_ZONA`), los jefes de mazmorra Esencia
  Abisal (`esenciaJefe`: 1, +1 en Desafío, 2 en banda). **Runas** en la
  Artesana desde Nv 40 (`RUNAS`, `costoRuna`, `grabarRuna`): Fuerza/Piedra/
  Vida, +2% por rango hasta 5 (+10%), coste 2.500·r² oro + materiales;
  logro «Maestro Rúnico». Receta «Destilar Flor de Luna».
- **Gesta semanal de hermandad** (hermandades.js `gestaDe/puntoGesta/
  cobrarGesta/guardarHermsSucias`): monstruo 1, jefe 10, mazmorra 25;
  Bronce 500 / Plata 1.500 / Oro 4.000 dan 100/250/500 × nivel de oro a
  quien aportó 20+ puntos (al pasar el nivel, al llegar al mínimo o al
  entrar). `h.gesta` se guarda cada 30 s (un reinicio puede perder hasta
  30 s de puntos). Logro «Gesta Dorada».
- **Equilibrio de afijos**: con `SEM=<lunes> EQ=1 node tools/sim_mazmorra.mjs
  ciudadela 5,10 desafio` (nuevo: fija la semana y equipa épicos) la semana
  Tiránico+Volcánico era mucho más dura que las demás; Volcánico pasó a
  cada 10 s, aviso 2 s, 10% y sin brotar a la vez que una zona del jefe.
  Sigue siendo la semana más dura; falta medir con jugadores reales.
- Web: /guia (banda, runas, monturas, mascotas, temporadas, gesta) y
  /novedades con la actualización. NOVEDADES del juego n=3.

**Revisiones y QA (todo arreglado y publicado, ?v=79 → ?v=89):**
- 1ª revisión (banda): una banda de 10 entraba a mazmorras de 5 y a
  Desafíos; más de 10 dentro de una instancia; la vida del jefe se fijaba
  con 1 jugador aunque llegaran 9 más; botín a quien no peleaba; zona
  dorada que golpeaba a gente fuera de la sala.
- 2ª revisión (runas y gesta): Esencia sin freno en las Catacumbas a Nv 60
  (ahora `ESENCIA_NV` = 40 y solo a quien pelea), entrar a una hermandad
  que ya llegó al Oro cobraba todo (ahora `GESTA_ANTIG_MS` = 1 día; la caza
  cuenta con monstruos de tu nivel o hasta 10 por debajo; la mazmorra, a
  quien pelea con el jefe final), reconexión a tu mazmorra propia con
  grupo, enfurecer al reescalar (`o.enfX`), hermandad disuelta que volvía
  al almacenamiento.
- QA de jugador (agente con Chrome sin ventana, PC y móvil): con 1-3
  jugadores entrar en la zona dorada no compensaba (ahora si nadie entra
  estalla con el doble), flecha "JUNTAOS" si la zona cae fuera de la
  pantalla, banda arriba del portal a Nv 60, marcos de grupo en 2 columnas
  en el móvil (>5), Esencia visible al momento, barra de la gesta por
  tramos con "cobrado/por cobrar", Artesana en cuadrícula, botón 📰
  Novedades en la Ayuda, Águila Real dorada (`MONTURAS.tinte`), Sapo más
  grande, mascotas por nivel.

**Después (?v=87-89):** calendario de temporadas completo hasta el 6 de
enero de 2028 (Festival del Viento en mayo, Ofrenda a la Pachamama en
agosto, Primavera Duende en septiembre y la vuelta anual de Noche, Cosecha
y Navidad con el mismo contador y títulos; el arnés lo permite si repiten
títulos). Caja **"Tu semana"** en el registro de misiones (L) para Nv 40+
(`cajaSemana`). **Primera victoria del servidor** contra el Titán
(`this.primeros` en storage 'primeros', anuncio global y título «Pionero
del Abismo»; excluye `UIDS_PRUEBA` vía `esPrueba`). Inspeccionar muestra
runas, Titanes y Pionero.

**Estado al cerrar (22-oct, mañana):** cliente **?v=89** (impares de esta
sesión; la otra iba por el 86), arnés **474**, 5 mazmorras + 1 banda. Todo
publicado con build y humo OK.

**Pendiente / ideas para la siguiente sesión del MMO (mazmorras, eventos,
social, equilibrio):**
- Medir con jugadores reales: dificultad de la banda (sim con EQ=1: guerrero
  solo ~2,5 min; 3-10 jugadores ~4 min), Volcánico, duelos.
- El mago solo y sin buen equipo no pasa la banda ni un +5 en el
  simulador: puede que la IA del bot sea mala (no se aleja de los packs);
  mirar antes de tocar la clase.
- Una 2ª banda o un modo heroico de la banda cuando haya gente a Nv 60.
- Sprites propios por clase; FPS en un teléfono real; /mmostats con datos.
- Precios con 4 cifras salen sin punto ("2500"): `toLocaleString('es')`
  no agrupa 4 cifras (detalle).

### DUENDE QUEST ONLINE — skins con poderes a la venta con SOL (22-oct-2026, mañana)

Pedido del dueño (en la sesión "Keep improving..."): "agrégale poderes a las
skins para que se vendan en Solana también; primero envían SOL a mi wallet y
yo envío la skin", "sigue mejorando y publica cada mejora hasta las 5 pm".
Esta sesión lleva la tienda (pares del `?v=`), la otra lo demás (impares).

- **Skins** (`SKINS` en data.js): `usd` 2/4/7/12/20 y poderes nuevos
  (`critBonus`, `xpMult`, `defMult` en `statsJugador` y `dar()`). Cada una es
  un paquete `skin_<id>` de `PAQUETES`. Web: SOL a `SOL_DEV_WALLET` (Phantom
  o firma pegada); Telegram: Stars (sus reglas no permiten otra cripto en
  Mini Apps; ningún texto de la Mini App menciona SOL). El dueño entrega con
  `/entregar CODIGO` (se añade y se pone; si ya la tenía, su precio en oro).
  Se siguen pudiendo comprar con oro. Términos §10 al día.
- **Pago con SOL seguro** (revisión): `verificarSol` exige una
  transferencia `jsonParsed` a la wallet por EXACTAMENTE `pd.lamports`; la
  firma `firma:<sig>` solo se gasta si es de ese pedido (o la cadena no
  respondió / aún no confirma); `anularPedido` la libera; un pedido
  `vencido` (24 h) también acepta el pago; el pedido se guarda antes de
  esperar a la cadena.
- Móvil: «Pagar con Phantom» sin Phantom abre el juego dentro de Phantom
  (`phantom.app/ul/browse/...`); «Tus compras» muestra los pedidos con SOL
  sin pagar con «Pagar» para retomarlos.
- Probador de skins (10 s, solo en tu pantalla) y cuánto cambian ataque,
  vida, defensa y crítico. Gestos (`GESTOS`): /saludar /bailar... y fila de
  emojis en el chat rápido del móvil. «Atrás» de Telegram cierra la ventana
  abierta. La ayuda (?) explica todo lo nuevo. Humo de producción con
  amigos y tienda.
- Ojo (del revisor): las skins del juego principal cuestan $25-$250 y pagar
  allí desbloquea la del MMO, que aquí cuesta $2-$20: decisión de precios
  del dueño.
- Más de la mañana (?v=84-90): etiquetas que no se salen del borde; flecha
  del borde más arriba; estadísticas del personaje en el inventario; aviso
  informativo de las skins a Nv 8; botones «Entregar/Anular» en el aviso de
  pedido del bot (`mmoent:`/`mmoanu:`/`mmoanu2:`, solo ADMIN_TG_ID);
  **/ventas** en el bot (interno `ventas`: 7 y 30 días, SOL/Stars, lo más
  vendido, pendientes); la factura de Stars de una skin lleva su imagen; /mmo
  del bot menciona skins y banda; en el móvil tocar el chat lo despliega.
- FPS (fps.mjs del QA, móvil 390×844 con CPU 4×, 14 monstruos): combate
  **59 FPS** con ?v=90 (13 a la 1 am).

- **?v=92-104 (mañana, más tarde):**
  - QA en producción: ventanas con la X fija y título sin pisarla; pestañas
    de tienda/social de alto fijo; nombres de monstruos amontonados se
    escalonan; errores iguales no se repiten en 1,5 s.
  - **Hora Feliz** (`HORA_FELIZ`, 20-21 h de Perú = 1-2 UTC): +50% XP; aviso
    al empezar/acabar; los avisos de vuelta (retencion.js) lo mencionan.
  - **Elo de duelos** (duelos.js): solo cuentas Nv 10+, 3 duelos contados al
    día por pareja, sin cuentas de prueba; huir (cambiar de mapa o alejarse
    más del punto de inicio) o desconectarse pierde. Ranking `rankDuelo`
    (top 30, escrituras en cola) en la ventana de ranking.
  - **Mercader ambulante** (viernes-domingo UTC): 2 colores + 1 mascota
    exclusivos por semana (`ambulanteOferta`), solo estética y con oro.
  - **Jefes mundiales que rotan** cada media hora (`MUNDIALES`/`mundialDe`):
    Gran Duende Corrupto, Dragón de la Tormenta, Coloso de Obsidiana.
  - **Pase de temporada mensual gratis** (`PASE`, functions/mmo/pase.js):
    20 niveles, puntos por diarias/semanales/bono/mazmorra/jefe mundial;
    premios oro/elixires/polvo + mascota «Duende del Pase» y logros. Sin
    mTON y sin versión de pago.
  - Revisión 4: retratos de mascotas con su color; Hora Feliz y jefe
    mundial juntos en el cartel; anular un pedido dos veces no devuelve dos
    veces (`anulando`); el chat del móvil ya no se come toques (se despliega
    solo al abrirlo con 💬).
  - Arnés: **500 bien, 0 mal**.
- **?v=106-114 (22-oct, media mañana):**
  - **Pesca** (`PESCA`, `pesqueroDe` en data.js; `pescar`/`finPesca`/`tirar`
    en profesiones.js): estanque en el pueblo (x 475) y en cada zona abierta
    (68% del ancho). Lanzar es un "cast" 'pescar' que acaba al picar (3-9 s,
    el cliente no lo sabe) y pasa a 'pica' 2 s: hay que tirar. Tirar antes
    asusta al pez; moverse o un golpe corta el sedal. 80 capturas al día.
    Pescado / Pez Dorado / cofre hundido (poco oro). La Artesana cocina
    Ceviche (+10% oro de caza) y Sudado Dorado (+5% daño, -5% recibido).
    Misión diaria y semanal, logros Pescador / Maestro Pescador. Sin mTON.
  - **Torre del Duende** (functions/mmo/torre.js, `MAPAS.torre`, `TORRE`):
    instancia 'torre#xxxx' con `w.torre` (NO `w.inst`). Desde Nv 10, solo o
    con el grupo junto al portal de mazmorras. Oleada por piso (2:30 para
    limpiarla), jefe de zona cada 5 marcado `mazmorra:true` para que no dé
    mTON (y `alAgro` solo arranca el combate de mazmorra si hay `w.inst`).
    Cofre cada 5 pisos nuevos de la semana; ranking semanal 'rankTorre' con
    premio al top 3 al cambiar la semana (`cerrarSemanaTorre`). Curva medida
    con `node tools/sim_mazmorra.mjs torre 30` (EQ=1 con equipo): solo Nv 30,
    pisos 12-24 sin equipo y 17-34 con equipo épico.
  - Arreglos del QA de producción ronda 2 (?v=110): mascotas con color en
    la tienda, Novedades solo en el pueblo, inventario de alto fijo, consejo
    del tutorial bajo el seguimiento en el móvil, rótulos de portales
    vecinos escalonados, no viajar por el borde a zonas 5+ niveles arriba,
    semanales nuevas (recoger, pescar), montura "Sabueso de Guerra".
  - Arnés: **530 bien, 0 mal**.
- **?v=116-126 (22-oct, antes del mediodía):**
  - Revisión de pesca/Torre: pesqueros de zona al 28% del ancho (lejos del
    jefe), subida que cruza el lunes no anota, ranking de la Torre con una
    sola carga (`rtP`), pantalla de muerte en la Torre, límite de subidas
    para todo el grupo. Premios semanales de la Torre (top 3, título «Rey de
    la Torre») y aviso a todos al batir el récord semanal (cada 5 pisos).
  - Bot: **/topmmo** (y /torre) con los rankings de la semana (interno
    'tops', solo nombres y marcas); botón «Ranking de la semana» en /mmo.
  - **Expediciones** (functions/mmo/expediciones.js, `EXPEDICION`): 1/4/8 h
    desde Nv 5, una a la vez, en el registro de misiones; la mascota no se ve
    mientras está fuera; el aviso de vuelta por Telegram lo menciona.
  - «💡 Qué hacer ahora» en el registro de misiones; **calendario** en
    Novedades; barras de progreso en los logros (`progresoLogro`);
    **Pececito Dorado** (solo pescando: 1/250, seguro a las 300 capturas).
  - Pago con SOL: cualquier wallet inyectada (Phantom, Solflare, Backpack) y
    botón «Pagar con Solflare» en el móvil sin wallet.
  - QA ronda 3: avisos por encima de ventanas, «Entregar misión» solo junto
    a Tito, cabecera de la Artesana, barra de lanzamiento en el móvil.
  - Arnés: **542 bien, 0 mal**.
- **?v=128-142 (22-oct, mediodía):**
  - Ranking semanal de **hermandades** por puntos de gesta ('rankHerm', se
    pone al día al guardar las gestas; una disuelta sale del ranking).
  - **Madriguera Goblin** (MAZMORRAS.madriguera, Nv 6-16, `sinDesafio`):
    la primera mazmorra; jefes mz_hongo / mz_rana / mz_cabecilla con avisos
    largos. Una mazmorra 10+ niveles por debajo de ti ya no suma gesta y su
    premio del día va por su nivel (+10).
  - **Lagarto de la Torre** (MONTURAS.torre, no se vende): al superar el
    piso 30 (`TORRE.montura`). Modificadores de piso (`modTorre`: Veloces,
    Blindados, Élite). Inspeccionar muestra Torre y peces.
  - Expediciones con **destino** (Bosque/Mina/Lago, doble de su material);
    a Nv 60 dan oro en vez de XP. Receta Pescado frito.
  - Avisos de Telegram: recuerdan la Torre si no subiste esta semana.
  - FPS móvil (CPU 4×, 14 monstruos): 59,5 en combate con ?v=132.
  - Arnés: **549 bien, 0 mal**.
- **?v=144-156 (22-oct, mediodía):**
  - **Pago con SOL**: QR de Solana Pay en la web (monto exacto + clave
    `reference` única por pedido, `pd.ref`), «Abrir en mi wallet» en el
    móvil y **«Ya pagué: comprobar»** (`pedidoBuscar`: busca por la
    reference y luego entre las 50 últimas firmas de la wallet). El pago con
    Phantom también lleva la reference.
  - **Endurecido tras revisión de seguridad** (v156): la firma solo se
    reserva y avisa al dueño si la cadena confirma el pago exacto (un error
    de la RPC ya no cuenta como «no existe»); `guardarPedidos` solo recorta
    pedidos cerrados; tope 10 pedidos/h por cuenta; ritmo por uid
    (`ritmoSol`); timeout 8 s; margen 30 s; marca única entre abiertos;
    web3.js@1.98.0 y qrcode-generator con SRI (si se cambia la versión, hay
    que recalcular el hash sha384).
  - Vitrina de skins junto al Mercader; avisos de lo que se abre al subir
    de nivel; logro Trotamundos; en mazmorras se revive junto a la última
    barrera abierta y **ningún monstruo cruza una barrera cerrada**.
  - Arnés: **554 bien, 0 mal**.
- **?v=158-176 (22-oct, primera hora de la tarde):**
  - Pago con SOL, segunda pasada: estado `comprobando` mientras se mira la
    cadena (ni /pedidos ni /entregar lo ven); fuera el aviso de «monto
    parecido»; «Ya pagué» también mira la wallet si la reference no da.
  - Mazmorras: los packs sin presa vuelven a su sitio y se curan; se
    revive dentro de la sala ya limpia (barrera − 120).
  - **Clima** (`climaDe` en data.js, por hora y zona): lluvia/nieve visual;
    con lluvia el Pez Dorado sale el doble. **Especies de peces**
    (`ESPECIES`, una por pesquero; oro la primera vez; logro Ictiólogo;
    colección en Inventario → BESTIARIO).
  - Torre: **atajo** (`atajoTorre`: con marca semanal 10+, empezar 5 pisos
    por debajo; en grupo solo si todos la tienen).
  - Misiones: diaria «Recoge una expedición», semanal «Supera 10 pisos de
    la Torre»; la expedición da 3 puntos del pase.
  - **Telegram**: dentro de la Mini App se ocultan los textos de SOL /
    wallets (`body.tg .solo-web` y filtro en Novedades).
  - Resistencia: 30 bots al azar, 10 min simulados, 0 excepciones
    (scratchpad/soak.mjs de esta sesión).
  - Arnés: **558 bien, 0 mal**.
- **?v=178-186 (22-oct, tarde):**
  - Revisión de la tarde: si caen todos, el jefe de mazmorra se recupera al
    momento (con el punto de control cerca se le ganaba por desgaste); un
    pedido «comprobando» atascado vuelve a esperar el pago; packs que se
    curan aunque estén cerca y pierden la furia; filtro de Telegram que no
    oculta «Fiesta del Sol».
  - Bot: **/yo** (interno 'perfil': tu personaje, solo el tuyo) y botón
    «Mi personaje» en /mmo.
  - Pronóstico del clima en el calendario; logros Buscador de Oro (25 Peces
    Dorados) y Gran Viajero (10 expediciones de 8 h); la vitrina se toca
    («VER SKINS»); **color de hermandad** (`HERM_COLORES`, lo elige el
    líder, mensaje 'hermColor'); «Compartir logro» anclado abajo en el móvil.
  - Resistencia 40 bots / 6 min: 0 errores. FPS móvil CPU 4×: 60.
  - Arnés: **562 bien, 0 mal**.
- **?v=188-200 (22-oct, tarde) — estilo profesional (pedido del dueño: «que
  no se vea tan IA, que se vea hecho por programadores reales»):**
  - Ayuda → **Guía del juego** por secciones (controles de teclado solo en
    PC, táctiles en el móvil: `.solo-pc` / `.solo-tactil`); Novedades →
    **Notas del parche** («Parche 1.N»); calendario en el mismo formato.
  - Sin emojis decorativos en títulos de ventanas, pestañas, botón de
    acción, seguimiento del HUD, cajas del registro de misiones, avisos y
    consejos (`sinEmoji()` en client.js; el tipo de aviso lo da la barra
    lateral de color). Botones del HUD con **iconos del pack 7Soul1** e
    iconos de línea SVG (sonido, inicio).
  - Avisos con una ventana abierta en una capa propia (`#avisos-modal`): el
    HUD vive en el contexto de apilado de `#app` y la ventana los tapaba.
  - QA 5: notas del parche/Bóveda también al entrar; monstruos de la Torre
    al 60% de experiencia (`TORRE.xp`, `xpX` ya se aplica en `matar`); su
    jefe no cuenta para misiones de historia; con mascota la expedición da
    +15% de oro; HUD de la Torre con el modificador del piso.
  - Un build de Workers Builds falló sin motivo (dry-run local bien): se
    reintentó con un commit vacío, como ya pasó el 2-oct.
- **?v=202-216 (22-oct, tarde) — segunda pasada de estilo (auditoría de
  textos con un agente):**
  - **Filtro global de emojis**: `sinEmoji()` quita pictogramas en cualquier
    posición; se aplica en `aviso()`, `emote()`, líneas de sistema del chat,
    `ponTxt()` y `etiqueta()` (con memoria `sinEmojiC`), y un
    `MutationObserver` limpia el texto de todas las ventanas (`.modal`),
    respetando `.ico`, campos de texto y `[data-emoji]`; la moneda 🪙 pasa a
    `<img class="moneda">`. Si un texto NECESITA un emoji, marcarlo con
    `data-emoji`.
  - Iconos del pack en NPC (moneda, medalla, frasco), pesquero, tarjetas
    (logros, bestiario, peces, Torre, chicha), recompensa diaria, monedero
    de mTON y destinos de expedición. Ranking con #1 #2 #3.
  - «Vosotros» → «ustedes» en todo el juego. Skins Nigromante y Rey. Números
    con separador de miles siempre (`useGrouping: 'always'`). Notas del
    parche con fechas «22 oct 2026». Aviso de seguridad solo en PREMIUM.
  - Élite de la Torre con tinte dorado y etiqueta (`o.ex = { elite: 1 }`).
  - Cloudflare tuvo builds lentos (incidencia de Durable Objects) hacia las
    13:20-13:45 de Perú: se esperó comprobando el `?v=` servido en vez de la
    API de GitHub (que limita a 60 consultas/hora sin token).
  - Arnés: **562 bien, 0 mal**. FPS móvil CPU 4×: 60.
- **?v=218-226 (22-oct, tarde) — tercera pasada de estilo (capturas de QA):**
  - Restos del filtro: `limpiarRestos()` quita «()» y espacios que deja un
    emoji borrado. Ojo: ◀ ▶ ⏱ ⏳ son pictogramas y el filtro los borra; ✓ ★ ☆
    ✗ ▲ no. El tutorial ya no depende de ◀ ▶.
  - Botones táctiles (chat, auto, esquivar, saltar, atacar) con iconos de
    línea SVG (`.ico-tc`); marco del objetivo con texto (Grupo, Herm.,
    Mensaje, Duelo, Amigo, Ver) en 2 filas de 3 **bajo el retrato** (dentro
    de `.cu` se cortaban en el móvil).
  - Avisos del servidor en tono de juego: sin «¡…!» ni emojis («Nueva
    montura: X. Mercader → Monturas.», «Has alcanzado el nivel N.»). Los
    gritos de jefes conservan la exclamación. El arnés ya no busca 🔥 en el
    aviso de invasión.
  - Panel de frases rápidas del chat con fondo propio; Torre con botones
    «Piso 1» / «Piso N»; libro de hechizos sin el tiempo de lanzamiento
    repetido y «Barra N» en táctil; inicio con «Gratis · Sin descargas ·
    Telegram y web» en una línea; en PC los avisos bajan (`#hud.tuto`)
    mientras se ve el consejo del tutorial.
  - Arnés: **562 bien, 0 mal**.
- **?v=228-236 (22-oct, tarde) — auditoría de textos (agente) y pulido:**
  - Botones que quedaban **vacíos** al quitar el emoji: susurro en Social
    («Susurrar»), precio en Stars («N Stars»), contador de la temporada en
    el HUD («Calabazas 12»), «(mira 💎)», «(o usa 👥)», «(🏆 en el
    pueblo)», «(🏠)». Regla: nombrar los botones por su nombre.
  - Quedaban «vosotros» en social.js, mazmorras.js, torre.js y una nota del
    parche → «ustedes». Plurales de consumibles (`PODERES[].plural`):
    «3 Pociones», «No te quedan pociones».
  - Logro del jefe mundial: «Azote del Coliseo» (antes «Cazador de
    Titanes», se confundía con el Titán de la banda). Pesca: «TIRAR».
  - La pantalla de muerte ya no dice «Pierdes un 5%…» a los novatos
    (`#muerte-xp`); «NV» en mayúsculas en el lienzo (en la letra pixel la v
    parecía u); flecha guía «Ir a Bosque Nocturno».
  - PREMIUM enseña el precio también a invitados ($ en la web, Stars en
    Telegram) junto a «Iniciar sesión».
  - Recompensa diaria con el icono de lo que da cada día; pantalla de carga
    con el duende y un consejo al azar (lista en `mmo/index.html`, script en
    línea junto a `#carga`).
  - Parche 1.9 en las notas del parche (interfaz renovada).
  - El arnés busca ahora «XP extra en tus próximas cazas» y «hasta 5».
  - Resistencia 20 bots / 3 min: 0 errores. Arnés: **562 bien, 0 mal**.
- **?v=238 (22-oct, 15:05) — QA 8 en producción (agente):** ventanas abren
  arriba (`abrir()` pone `.ventana.scrollTop = 0`), pase «Nv N · premio»,
  miles con `useGrouping: 'always'` en el pase, forja con coma decimal,
  «retiro/retiros», «Nv N» sin partir en el libro.
  - **Pendiente de QA 8** (no se hizo por tiempo):
    1. Móvil: con el chat abierto los avisos (`#hud.estrecho #avisos`,
       top 322px) tapan el panel `#frases`; también tapan la etiqueta de la
       flecha guía en combate.
    2. Móvil: el chat plegado (`#chat-log` max-height 34px) enseña la cola de
       un mensaje y pisa la placa del jugador.
    3. «Misión cumplida» sale dos veces (consejo del tutorial paso 5 + aviso
       del servidor, world.js ~1589).
    4. PREMIUM en móvil: columna de precio + botón muy ancha; apilar el botón
       bajo el texto en pantallas estrechas.
    5. Gestos del chat móvil son emojis sueltos (`GESTOS[k].e`): ponerles
       texto o iconos. AUTO cambia de ancho al activarse (`pintarAuto`).
    6. Detalles: nombre vacío al entrar solo pone el borde rojo; «29 caz.»
       en el ranking; iconos de Escudo/Poción del pack con texto en inglés
       («LAW», «ENERGY»).
  - Los invitados de QA **Qa82508p** y **Qa84334m** (Nv 2) aparecen en el
    ranking semanal de producción; desaparecen con el cierre semanal.
- **Reel publicitario (22-oct):** `tools/reel_grabar.mjs` graba escenas
  del juego en local con `Page.startScreencast` (405×720, ~55 fps) y
  rótulos en el DOM con Press Start 2P; ffmpeg las une con fundidos a
  1080×1920 (24 s, sin música).
### DUENDE QUEST ONLINE — Modo Dios, skins premium con SOL/$DUENDE y auditoría (22-oct-2026, tarde)

Pedido del dueño: probar la seguridad con agentes, que nadie entre con
cualquier nombre, ser moderador con modo dios, vender skins directo con SOL o
$DUENDE (entrega manual desde el modo dios), mejores gráficos de enemigos,
duende más fluido, mundo más vivo y arreglar que ↑ metía en mazmorras.
Cliente **?v=239** (integrado sobre el ?v=238 de la otra sesión).

- **↑ / W ya no entran a portales** (solo saltan; se entra con E). En el pueblo
  caminar hasta el borde ya no te manda a Acantilados (`viajePorBorde` solo en zonas).
- **Nombres únicos y reservados** (`functions/mmo/dios.js`): clave `n:<nombre
  normalizado>` (sin tildes, espacios ni '_'); "admin", "moderador", "El Duende",
  "GM"... reservados; `limpiarNombre` solo deja letras latinas (el cirílico
  igual al latino servía para suplantar). Los nombres viejos se reservan
  cuando su dueño vuelve a entrar (no hay migración de duplicados antiguos).
- **Login con correo dentro del MMO** (Supabase; la sesión queda guardada en
  el navegador) y "Cerrar sesión / usar otra cuenta".
- **Modo Dios** (F2 o botón 👑, solo lo ve el dios; lo decide el servidor):
  dios = `tg:ADMIN_TG_ID` o lo que diga el secreto **`MMO_ADMINS`** (uids
  `web:<id>` o correos web CONFIRMADOS, separados por comas). Poderes:
  invencible, golpe divino, velocidad libre, curarse, viajar a cualquier mapa;
  jugadores: ir, traer, dar/quitar oro, dar/quitar skin, renombrar, silenciar,
  expulsar, banear (storage `mod`); pedidos: entregar/anular desde el juego;
  anuncios; registro de las últimas acciones. Con un poder encendido no se
  gana mTON ni se sube en el ranking. Etiqueta "👑 GM" sobre el nombre y en el chat.
  **Para activarlo en la web:** `npx wrangler secret put MMO_ADMINS` con tu
  correo de la cuenta web (o `web:<uuid>`). Por Telegram ya funciona con ADMIN_TG_ID.
- **Skins premium** (`SKINS` en data.js, `premium: true`, precio null = no se
  venden por oro): Esmeralda $5, Sombrío $10, Solar $25, Cósmico $50; usan la
  hoja ANIMADA del duende teñida (`hue`, `sat`) + aura. Las 5 de oro también
  se pueden comprar directo (`usd`). Paquetes `skin_<id>` en `PAQUETES`.
  Ninguna skin cambia los mTON. **Bloqueado**: comprar una premium por oro
  (`c.oro -= null` no restaba nada).
- **Pago con $DUENDE** (`metodo: 'duende'`, 10% de descuento): precio = el MÁS
  BAJO de las últimas 6 h (`precioDuendeSeguro`, la capitalización es pequeña y
  se podía inflar un momento), monto en unidades mínimas con 4 cifras propias;
  Phantom arma un TransferChecked leyendo cuentas y programa de la cadena.
- **Verificación de pagos SOL y $DUENDE**: ahora exige una transferencia EXACTA
  del monto del pedido a la wallet del dueño (`leerTx` con jsonParsed); antes
  valía cualquier pago ≥99% que entrara (se podía reclamar el pago de otro).
  La firma solo se "quema" si el pago es válido.
- **Auditoría (5 agentes, informes en la conversación)**, arreglado:
  speed-hack por mensajes cortos (`movBud`, presupuesto que se recarga),
  carrera en `pedido()` (1 a la vez y cada 10 s) y poda que borraba pedidos
  pagados, tope de sockets sin identificar (40) y por IP (8), máx. 6 invitados
  nuevos por IP y hora, guardados sin cambio (tinte/mascota ''), ranking y
  `quien` con límite, Stars que no cuadran quedan "por revisar", webhook del
  bot CERRADO si falta el secreto, sin precio de respaldo fijo en Stars,
  `constructor`/`__proto__` como skin en la API, el MMO ya no regala skins por
  `profiles.wallet_solana` (se podía poner la wallet de otro comprador), la
  Mini App no lee `telegram_id` del ranking.
- **Pendiente del dueño — ejecutar `sql/05-auditoria-oct.sql`** en Supabase
  tras el push (cierra la lectura pública de tablas de dinero y de telegram_id).
- **Pendiente (no hecho):** CSP completa en worker.js, ligar compras SOL web a
  la cuenta (`create_sol_order` sin identidad en helius-verify), `ton_proof`
  para la wallet TON, migrar nombres duplicados antiguos, sybil de mTON con
  cuentas web, límites por tipo de mensaje restantes, `ret:idx` que crece.
- **Gráficos**: monstruos con contorno (dorado en élites, magenta en jefes),
  respiran, se aplastan al recibir golpes, los voladores aletean y estallan en
  chispas al morir; ambiente por bioma (luciérnagas, ceniza, chispas,
  burbujas) y hierba que se aparta al pasar; polvo al correr/aterrizar y estela
  del dash; el duende se dibuja interpolado entre pasos de física (sin tirones).
- Textos para foros: `promo/POSTS_FOROS.md` (no se sube a git).

### Cuentas en el MMO, portada en vivo y control del salto (23-oct-2026)

Cliente **?v=240**, arnés 580.
- **Cuenta dentro del MMO** (`pintarCuenta` en client.js, Supabase Auth): entrar,
  crear cuenta (usuario + correo + contraseña ≥ 8), "¿Olvidaste tu
  contraseña?" (`resetPasswordForEmail`, vuelve a /mmo/ con type=recovery →
  formulario de contraseña nueva), entrar con enlace al correo
  (`signInWithOtp`, sin crear cuentas) y cambiar contraseña. Botón de cuenta
  en la barra (late mientras juegas como invitado); en partida, al entrar o
  crear cuenta se recarga y el servidor pasa el personaje de invitado a la
  cuenta si esta aún no tiene uno. Los "Iniciar sesión" de la tienda abren
  esto (ya no mandan al arcade).
- **Supabase debe permitir volver a /mmo/**: Authentication → URL
  Configuration → Redirect URLs con `https://duende-quest.alfonso12hc.workers.dev/**`.
- **Inicio (casa) → portada `/`** (antes iba al arcade). En la portada, panel
  "en vivo": jugando ahora y jugaron hoy (GET /mmo/ws devuelve `online` y
  `hoy`, este último cacheado 60 s) y cuenta atrás real del jefe mundial;
  los contadores se ocultan si son 0 (nada inventado).
- **Control**: tiempo de gracia de 6 fotogramas al caer de un borde, salto
  memorizado 8 fotogramas antes de aterrizar, salto corto al soltar la
  tecla (también el botón táctil) y golpe memorizado en los últimos 180 ms
  de recarga.

### Mundo abierto sin cortes, piedras de viaje y Marcha de invasores (23-oct-2026)

Cliente **?v=242**, arnés **597**.
- **Cruce por el borde sin corte**: `viajePorBorde` manda `{t:'portal', i, borde:1}`
  (sin tener que soltar la tecla; sigue el aviso de nivel alto). `portal()` en
  world.js coloca al jugador a 70 px del borde de entrada y marca `sc:1` en el
  mensaje 'mapa'. El cliente no hace fundido: guarda una foto de la escena y
  la funde (`cruce`), conserva la velocidad y arranca la cámara donde estaba
  el duende en pantalla. Ahora también vale en el pueblo (borde izquierdo →
  Bosque; el derecho lo frena el aviso de nivel).
- **Piedras de viaje** (`functions/mmo/viajes.js`, `PIEDRA_X`, `costoViaje`,
  `tienePiedra` en data.js): una por zona abierta en x 230; viaja a zonas de
  `c.visitadas` (se envía en `yo.visitadas`), fuera de combate, 20 oro × nivel
  mínimo de la zona, 8 s de recarga. Ventana `m-viaje`.
- **Marcha de invasores** (eventos.js): ganar una invasión agenda `this.marcha`
  en `zonaSiguiente()` (portal del borde derecho) a 25 s; hasta 3 etapas,
  premio ×1 / ×1,3 / ×1,6 y la 3.ª da objeto épico+. Perder no marcha.
- Novedades n=10 y la guía del juego explican todo esto.

## DUENDE QUEST 3D — mundo abierto (23-oct-2026), fase 1 (beta) en /mundo/

Pedido del dueño: "como WoW o AION". Se eligió 3D estilo Ragnarok/Octopath:
mundo 3D (Three.js 0.160 por importmap de jsdelivr) y los sprites de siempre
como planos que miran a la cámara. Cliente `/mundo/js/mundo.js?v=243`;
el 2D pasa a `?v=243` (comparten `data.js?v=243`). Arnés **620**.

- **Mismo servidor y mismo personaje**: `hola` con `modo:'3d'` → `entrar3d`
  (functions/mmo/mundo3d.js). `s.m3 = true`, `s.k = '~3d'`; sus mensajes van
  a `recibir3d` y `tick()` los aparta en `tick3d`. Posición en `s.p` y
  `c.p3` (el `c.mapa`/`c.x` del 2D no se toca). `entrarMapa` no hace nada a
  un jugador 3D (grupos que entran a mazmorras/Torre desde el 2D).
- **Mundo** (mmo/js/mundo3d.js, compartido; recibe MAPAS/MONSTRUOS por
  parámetro): 1.320 m de lado, pueblo en el centro y las 10 zonas en espiral
  (Voronoi con transición de 60 m), relieve con ruido determinista, agua,
  cordillera en el borde, 150 campamentos (15 por zona, el jefe en el más
  lejano). Los monstruos solo existen cerca de jugadores (170 m) y se
  retiran a 240 m; pasivos salvo jefes (16 m); correa de 50 m.
- **Combate**: `atk3` ataque automático (cuerpo a cuerpo 1 golpe/s con el
  mismo daño por segundo que el combo 2D; vara a su ritmo, 24 m); premios con
  `dar()` → misiones, diarias, bestiario, chicha, pase y botín igual que el
  2D. Consumibles (`pw`), muerte y `revivir` en el pueblo, Mercader
  (`cercaDelMercader` sabe del 3D) y Guardia (`mision(s, m, true)`).
- **Cliente**: terreno con colores por zona y caminos, ~5.000 árboles
  instanciados por bioma, casas del pueblo, portal (manda al 2D), cielo y
  niebla del color de cada zona, título al entrar a una zona, minimapa y
  mapa del mundo, etiquetas HTML, números de daño, proyectiles. Controles
  WASD + arrastrar cámara + rueda, Tab/clic objetivo, 1/Z ataque automático
  (camina solo hasta el objetivo), Q F G T, E hablar, M mapa, Enter chat.
  Móvil: joystick, arrastrar para girar, botones OBJ/SALTO/ATACAR. Medido:
  2,6 ms por cuadro con 10 monstruos. `window.__dq3` = estado de depuración
  (y `cuadro()` para avanzar a mano con el panel oculto).
- **Aún en el 2D** (botón 2D, mismo personaje): inventario y equipo,
  talentos, habilidades de clase, mazmorras/Torre/banda, artesanía, pesca,
  duelos, hermandades, monturas, tienda completa. Siguientes fases: llevar
  las habilidades de clase al 3D, mazmorras como instancias 3D, ventanas de
  inventario/talentos, monturas y vuelo (AION), jefe mundial.

### Fase 2 del 3D (23-oct-2026, `?v=244`) — habilidades, vuelo, monturas y ventanas. Arnés **635**

- **Habilidades de clase en el 3D** (`hab3d`/`aplicar3d` en
  functions/mmo/mundo3d.js): las 32 de HABS con los mismos datos que el 2D
  (alcance `rango/17` m; cuerpo a cuerpo `MELEE/33*alcance+0.6`), GCD 1 s,
  lanzamientos que se cancelan al moverse (>0,3 m), auras, combo del pícaro,
  carga, polimorfia, sigilo, resurrección… Mensajes: `cast`, `castFin`, `hb`,
  `cd` (`h_<id>`), `au`, `cu`. `amenazaCura` (combate.js) sabe del 3D.
- **Cliente**: barra con ataque (1), habilidades 2-9 (bloqueadas hasta su
  nivel), consumibles Q F G T; barra de lanzamiento, puntos de combo, auras
  propias, color del recurso de la clase, ondas de área y proyectiles.
- **Monturas**: Y (`montar`, mismo lanzamiento de 1,5 s que el 2D;
  `velMontura`).
- **Vuelo estilo AION**: V o doble salto despliega alas de luz; Espacio sube,
  C/Mayús baja; 60 s de energía que se recarga en el suelo; planeo al
  acabarse. Prohibido en el pueblo. El servidor recibe la altura (`mv3.h`,
  tope 50 m, `a:3`), da +30 % de velocidad volando, no deja combatir por
  encima de 4 m y los monstruos sueltan a quien vuela por encima de 8 m. Los
  demás jugadores ven la altura (9º campo de `s3.p`).
- **Ventanas** (mundo/js/ventanas.js): inventario (I), libro de clase con
  habilidades, talentos y especialización (P), logros (L), tienda completa
  (desde el Mercader) y tienda premium (💎) con pagos SOL/$DUENDE/Stars
  (`pedido`, `pedidoFirma`, `pedidoBuscar` ya entran por `recibir3d`).
- Pendiente: modelos 3D de verdad para duende/monstruos/monturas (en curso),
  mazmorras como instancias 3D, jefe mundial, artesanía/pesca/duelos en 3D.

### Jefe mundial del 3D (23-oct-2026, `?v=245`). Arnés **645**

- Claro del Titán (`ARENA3D` en mmo/js/mundo3d.js, (82, −47), Amanecer):
  círculo de menhires. El jefe sale a las **:15 y :45** (el del Coliseo 2D
  sigue a las :00 y :30), rota entre los 3 `MUNDIALES`, vida
  20.000 + 15.000 × jugadores del 3D, 10 minutos para matarlo.
- Pega a quien más amenaza tiene; sus golpes quitan un % de la vida (todos
  los niveles juntos). Cada 12 s un **pisotón**: círculo rojo de 9 m en el
  suelo (`zona3`) que se llena en 2,5 s y luego quita el 30 % a quien siga
  dentro (`zona3f`, sacudida de cámara). Por debajo del 30 % se enfurece
  (pisotones más seguidos y del 45 %).
- Premios: `premiosMundial(o, K3)` (mismo premio que el Coliseo: XP, oro,
  pieza, pase, tareas, mTON con ≥2 % del daño).
- Cliente: cuenta atrás en el HUD (`mundial3`), marca en minimapa y mapa,
  jefe 2,4 veces más grande.
- Moderadores: escribir `/jefe` en el chat del 3D lo invoca ya (acción
  `dios` `mundial3`).

### Modelos 3D (23-oct-2026, `?v=246`)

- `mundo/js/modelos.js`: modelos low-poly hechos con primitivas (sin
  texturas), con rig animado por código. API: `crearDuende({skin, clase,
  arma})`, `crearMonstruo(k)` (las 76 claves de MONSTRUOS, 30 arquetipos),
  `crearNpc(hoja)`, `crearMontura(id)` (con `.silla`), `precalentar()`.
  Estados: quieto, anda, corre, ataca, lanza, herido, muere, salta, vuela,
  nada, monta. Geometrías y materiales compartidos (≤30 mallas por modelo):
  no tocar la opacidad/color de un material sin clonarlo.
- `mundo/galeria.html`: los 122 modelos (`?filtro=&estado=ataca&gira=0`,
  `window.QA` = informe de mallas).
- `mundo.js`: `Figura3D` envuelve un Modelo con la interfaz de la Figura de
  sprites (poner/quitar/m para el clic con un cilindro invisible). Si un
  modelo falla, cae al sprite; `?sprites=1` (o localStorage `dq3_sprites=1`)
  fuerza los sprites. Jinete con `'monta'` en la silla de la montura; alas
  en la espalda (también se ven las de otros jugadores); nombre más alto al
  ir montado.
- Cámara: rejilla de árboles de 8 m; si uno se mete entre la cámara y el
  duende, la cámara se acerca (`choqueCamara`).
- Medido: 3,5 ms por cuadro con 10-12 monstruos (sprites: 2,6 ms).

### Grupo en el 3D (23-oct-2026, `?v=247`). Arnés **651**

- `recibir3d` acepta invitar, grupoResp, salirGrupo, expulsarGrupo y
  liderGrupo (los mismos de social.js). `infoMiembro` lleva `p3` (posición
  3D) para el minimapa.
- `matar3d`: los compañeros de grupo a 60 m que no pegaron reciben `dar()`
  con el 60 % de la XP y la mitad del oro (cuenta para misiones, diarias y
  bestiario).
- Cliente: clic en un jugador → marco `#objp` (Invitar / Susurrar); los
  hechizos de aliado usan ese jugador. Marco de grupo `#grupo3` (clic en un
  miembro para elegirlo), invitación `#invit3`, compañeros en celeste en el
  minimapa, chat `/g` y `/s nombre`.

### Día, noche, clima y música (23-oct-2026, `?v=248`). Arnés **655**

- `mmo/js/mundo3d.js`: `DIA_MS` (48 min), `horaMundo(t)`, `esNoche(t)` y
  `climaEn(zona, t)` (tandas de 12 min, deterministas: todos ven lo mismo;
  el pueblo, siempre despejado). Servidor: +10 % de XP de noche en `matar3d`.
- Cliente: `ambiente(z)` cada 15 cuadros (luz, color del sol, cielo con
  ocaso y noche, estrellas, niebla por clima, faroles del pueblo); lluvia y
  nieve como segmentos alrededor de la cámara (`moverLluvia`), relámpagos
  en la tormenta. Hora y clima bajo el minimapa (`#mini-r`).
- `mundo/js/musica.js`: música generada con WebAudio (escala, nota base y
  ritmo por zona; bordón, acordes y notas con eco; más lenta de noche),
  lluvia de ruido filtrado y truenos. Arranca con el primer gesto; botón
  `#b-son` (guarda `dq_mmo_sonido`).
- Para probar: `/mundo/?clima=lluvia|tormenta|nieve|niebla|arena&hora=0..24`.

### Recolección y artesanía en el 3D (23-oct-2026, `?v=249`). Arnés **661**

- `nodos3d(MAPAS, MONSTRUOS)` en mmo/js/mundo3d.js: 24 puntos por zona
  (hierba/mineral alternos, lejos de campamentos), deterministas. 228 en
  total. `RECOGER_DIST` = 3,5 m.
- Servidor: `recolectar3d` (cast 'recolectar' de 1,5 s; `revisarCast`
  llama a `terminarRecoleccion3d` si `s.m3`), marca `c.nodos['3d:<i>']`
  de 5 min, mismos materiales y raros que el 2D. `nodos3` al entrar con los
  que siguen recogidos. `fabricar` entra por `recibir3d` y
  `cercaDeArtesana` sabe del 3D.
- Cliente: los puntos son 4 InstancedMesh (mata, flores, roca, vetas); los
  recogidos se esconden (escala ~0) hasta que vuelven. E o el botón inferior
  recoge. La Artesana muestra materiales y las RECETAS.

### Rastreador de misiones (23-oct-2026, `?v=250`)

- `pintarMisiones()` cada 20 cuadros: misión de la cadena (`yo.mis`) y la
  diaria; meta = campamento más cercano con `k === MISIONES[i].tipo` (las 40
  tienen campamento en el 3D) o el Guardia si ya está lista. Flecha relativa
  a la cámara y distancia.
- `faro`: cilindro de luz sobre la meta (dorado; verde si es el Guardia).
  Minimapa: `!`/`?` en la meta o en el borde si está lejos; mapa grande
  también. El Guardia muestra `?` cuando hay algo que entregar.

### Editor de apariencia (23-oct-2026, `?v=251`). Arnés **664**

- data.js: `APARIENCIA` (6 caras, 3 cuerpos, altura 0,9-1,12, 8 peinados, 8
  colores), `LOOK_BASE` y `limpiarLook` (valida todo lo del cliente).
- Servidor: `look` en `recibir3d` → `cambiarLook` (cada 1,5 s como mucho)
  guarda `c.look` limpio, va en `datosPropios.look` y en
  `infoApariencia.lk` (los demás reconstruyen el modelo con `pa`).
- modelos.js: `crearDuende({ skin, clase, arma, look })`; `m.alto` =
  1,75 × altura; el pelo asoma bajo cascos y capuchas; galería
  `?filtro=look`.
- Cliente: panel `#v-look` (cámara de frente, vista previa en vivo sobre
  el propio modelo, al azar / guardar / cancelar), botón 🪞; se abre solo
  la primera vez (`dq3_look_visto`).

### La Cueva de los Goblins (23-oct-2026, `?v=252`). Arnés **673**

- mmo/js/cueva3d.js: plano (7 salas/pasillos como rectángulos), grupos,
  jefe (`jefe_rey`), cofre, `caminable()`, `PORTAL_PUEBLO`. La cueva está en
  x ≥ 3000 (`CUEVA_X0`); allí `alturaEn` = 0 y `zonaEn` = 'cueva'.
- functions/mmo/cueva3d.js (mixin `Cueva3D`): `entrarCueva` (junto al
  portal; instancia por grupo `g<id>` o por jugador `u<uid>`, nivel del más
  alto 5-60), `salirCueva` (portal de la entrada), `tickCuevas` (pisotón
  cada 11 s con aviso de 2,2 s, guardia al 50 %, furia al 25 %; instancia
  vacía 5 min → se borra) y `premiosCueva` (XP, oro, pieza rara+, mazmorra
  +1, tarea 'mazmorra').
- mundo3d.js: todo filtra por `mismo(a, b)` (i3): fotos (jugadores y
  monstruos), IA, objetivos, áreas, curas, XP compartida. En la cueva todos
  los monstruos son agresivos (11 m) y avisan a los de su sala. `mover3d`
  solo deja caminar por `caminable`; la posición de la cueva no se guarda
  (al reconectar, al pueblo).
- Cliente: mundo/js/cueva.js (suelo, paredes de roca rasterizadas, techo,
  antorchas con luz, estalagmitas, cristales, trono, portal, cofre); colisión
  con resbalón por paredes; cámara que no sale de la cueva y bajo el techo;
  minimapa de la cueva; el portal del pueblo abre un menú (cueva 3D o 2D).

### Modelos fieles al 2D, duelos y pesca en el 3D (23-oct-2026, `?v=253`). Arnés **682**

- modelos.js (agente): cada familia copia colores, silueta y accesorios de
  su hoja 2D (y cada skin del duende, de su imagen). La galería pone el
  cuadro 2D al lado de cada modelo (`?filtro=a|b`). No poner emisivo a los
  materiales compartidos con color por vértice.
- Duelos: duelos.js mide con `distD` (en el 3D, metros × 17) y guarda `p0`;
  nada de duelos dentro de la cueva. `recibir3d` acepta retar/retoResp;
  `atk3` con `tp` → `atacarDuelo3d` (golpeDuelo); `hab3` con `tp` →
  `habDuelo` (solo habilidades de un objetivo). Cliente: botón «Retar a
  duelo», reto con Aceptar/Rechazar, el ataque automático y las habilidades
  van al rival (`blancoAtk`).
- Pesca: `pescar3d` (agua a <6 m, `aguaCerca3d`), la zona de la orilla es el
  pesquero (`s.pesca3`); `tirar()` usa la especie y el clima de esa zona.
  Cliente: E pesca/tira, corcho que se hunde al picar.

### Calidad gráfica y rendimiento (23-oct-2026, `?v=254`)

- `CALIDADES` en mundo.js (localStorage `dq3_calidad`; por defecto media en
  móvil y alta en PC): baja (pixelRatio 0,75, niebla a 130 m), media (1,
  170 m), alta (1,5, 230 m, antialias y sombras PCF suaves 1024 con la cámara
  de sombra de ±26 m siguiendo al duende). En alta las figuras proyectan
  sombra y el terreno la recibe; a más de 24 m vuelve la mancha simple.
- `Figura3D.poner`: no dibuja lo que está tras la niebla y anima a cuadros
  alternos lo que está a más de 45 m. Medido: baja 1,9 ms, alta 3,0 ms.
- Móvil: botones en rejilla de 2 columnas; misiones y chat apilados bajo el
  marco por código (no tapan los controles táctiles).

### Alas y planeo (23-oct-2026, `?v=255`). Arnés **687**

- data.js `ALAS` (vuelo s, vel, forma, color, brillo; precio en oro, por
  mazmorras o premium con `usd` → paquetes `alas_<id>`), `alaDe(c)`.
- world.js: `comprar` k 'alas' (comprar o ponerse), `c.alas`/`c.ala` en
  datosPropios, `al` en infoApariencia; los pedidos premium de alas se
  entregan como las skins. cueva3d.js da 'cueva' al llegar a 5 mazmorras.
- mundo3d.js: velocidad en el aire según las alas (a = 3) y planeo (a = 4,
  ×1,4); energía controlada en el servidor (`vueloS`, tope vuelo + 8 s →
  'alasAgotadas').
- Cliente: `geoAla(forma)` + `nuevasAlas(id)` (membrana con huesos, brillo
  aditivo); las propias se rehacen al cambiar; las de otros por `q.al`.
  Planeo: Espacio mantenido cayendo (sin gastar); doble salto solo vuela si
  aún subes. Barra ALAS bajo el marco.

### Interfaz sin cortes y combate más fluido (23-oct-2026, `?v=256`)

- `LATERALES` (v-npc, v-ayuda, v-inv, v-libro, v-tienda, v-logros): CSS de
  panel a la izquierda sin velo; `hayVentana()` solo cuenta las bloqueantes,
  `hayLateral()` deja caminar (Escape/tecla las cierran). El diálogo de un
  PNJ se cierra al alejarse.
- `#avisos` a la izquierda sobre el chat; `#titulo-zona` arriba y más
  pequeño.
- Cámara: sin colisión con árboles (solo paredes de la cueva).
- Minimapa: flecha con `rotate(PI - P.ry)` y cono de cámara con
  `rotate(-camYaw)`; `flechaDir` del rastreador corregida (estaba en espejo).
- `sfx()` con WebAudio: buffers decodificados una vez, 8 voces, tono ±6 %.

### Física del duende (23-oct-2026, `?v=257`)

- `solidos` (rejilla de 8 m) con círculos: troncos (`SOLIDO` por tipo de
  flora × escala), rocas, cactus, pilares, cristales, PNJ y pilares del
  portal; casas como cajas giradas (`CASAS`). `empujarFuera(x, z)` saca el
  círculo del duende (0,45 m) de cada uno: así resbala.
- Inercia: `P.vx/P.vz` se acercan a la velocidad deseada con
  `1 - exp(-agarre·dt)` (16 en el suelo, 3 en el aire, 4 volando, 5
  nadando). Giro suave con `lerpAng`. Medido: se para en z = 48,45 contra una
  casa con borde en 48 y resbala por la pared.

### Combate sin lag (23-oct-2026, `?v=258`) — aplicado de la auditoría de 20 especialistas

- Servidor: `JITTER_MS` = 150 (golpes y habilidades que llegan un poco
  antes cuentan; la cadencia se mide desde el golpe anterior);
  'atkNo'/'habNo' para que el cliente reintente; `aCerca3d` (at3, atp3, hb,
  cast, castFin, b3, pw) solo a los de cerca y de la misma instancia;
  `fotos3d` con `ts`, jugadores a < 160 m (salen a 190 m, los del grupo
  siempre) y presentados con pj3; 'yo' diferido en el 3D (`yoLuego`,
  `vaciarYo` cada 1 s con 'yoC' de ~250 B; 'yo' entero si hay botín,
  subida o logro); margen de movimiento `vel*1,5+4`.
- Cliente: `mandarPos(true)` antes de atk3/hab3; cola de hechizos (400 ms);
  la recarga 'h_<id>' se guarda en `cdHab` (antes nunca se pintaba);
  interpolación lineal por tramos (`fijarDestino`/`avanzarHacia`);
  predicción del impacto y vida que baja con at3/hb/ph; balas y ondas con
  geometría compartida; máximo 24 números; marco del objetivo solo si
  cambia; `render.compile` al cargar; correcciones pequeñas del servidor
  repartidas en ~150 ms.
- Medido en una pelea: 2,5 ms de mediana por cuadro, p95 7,2 ms, sin
  tareas largas.

### Auditoría de 20 especialistas aplicada (23-oct-2026, `?v=259`). Arnés **688**

- Servidor: `mover3d` valida el modo de vuelo y simula la altura (sube
  ≤6,5 m/s, el planeo siempre baja, a pie no se sube), energía contada con
  el modo anterior y en el tick si no llegan mensajes; presupuesto `vel+3`
  sin el mínimo de 16 ms; casas en el servidor; aturdido/bloque no mueven ni
  pegan; el lanzamiento se corta a 0,8 m del inicio. `ia3d` reescrita:
  amenaza para todos (110 %/130 %), solo se reinicia sin nadie en la lista,
  inmune mientras vuelve, correa limpia, jefe mundial conserva el daño,
  `pasoCueva`/`vistaCueva` (puertas), centinelas en la cueva, rodean al
  jugador, 400 ms de preparación, no atraviesan casas. Duelos con
  lanzamientos (tk 'd'), Ejecutar/Eviscerar/mínimo. `reiniciarJefeCueva`;
  cueva: participación, 3 cofres completos al día, nivel ±10, límite de
  instancias (1/min por personaje, 40 en total), fuera de combate, el Rey
  escala con quien entra; sin mTON ni botín doble del Rey. Jefe mundial: 0,3 %
  de daño mínimo y 6 premios completos al día. `aDe`/`aMon` (combate.js):
  auras, curas, castFin y 'ph' solo a los cercanos; auras de la cueva por
  fin llegan. `olvidar3d`; campamentos que se vaciaban para siempre;
  revivir sale de la cueva bien.
- Cliente: física siempre activa (sin control con ventanas), bordes, coyote,
  memoria de salto, salto variable, sub-pasos, planeo automático, pueblo
  como pared blanda; cámara con `choqueTerreno`, suavizado asimétrico con
  espera y mínimo, cueva con vista alta y techo a 8 m; snap3 reemplaza;
  'm3' limpia monstruos fantasma y combate; círculos del pisotón liberados;
  fugas de alas/corcho; un panel lateral a la vez; 'yoC' refresca paneles;
  selects sin robar teclas; animación de ataque reiniciada en cada golpe y
  tajo del monstruo sincronizado con 'ph'.
- modelos.js (agente): `fusionarRig` funde las piezas fijas por pivote
  (3426 → 1321 mallas en la galería; duende 23 → 6); `?sinFusion=1` lo
  desactiva. Medido en combate: 1,4 ms de mediana, p95 2,4 ms.

### Transparencia de lo que tapa, luz y móvil (23-oct-2026, `?v=260`)

- mundo/js/tapa.js: `transparentar(mat)` agujerea con tramado lo que queda en
  el tubo cámara→duende (uniforms `TAPA.uCam/uTgt`, actualizados tras colocar
  la cámara). Aplicado a la flora, las casas y las rocas de la cueva.
- Luz: sol ×2, hemisferio ×1,5 teñido con el cielo de la zona (y el suelo
  de la zona abajo).
- Flora troceada en celdas de 96 m (InstancedMesh por celda, un material por
  tipo y pieza); `cullFlora()` oculta las celdas tras la niebla.
- Móvil: #barra en rejilla de 6 columnas a todo el ancho; #tactil más arriba;
  joystick con z-index por debajo de los paneles; #botones 3×3 de 38 px (2D y
  portada pasan a la ayuda); columna izquierda apilada por código; botón
  táctil #t-usar; #lanzar e #invit3 fuera de los controles.

### El Abismo de Éter: islas, facciones y viaje (23-oct-2026, `?v=261`)

- mmo/js/abismo3d.js (compartido): `ABISMO_X0=6000`, 13 islas `{x,z,r,h}`,
  `FACCIONES` luz/sombra, `alturaAbismo` (VACIO=-140 fuera de las islas),
  `islaEn`, `baseDe`, `portalBase`, `camposAbismo` (zona 'eter').
  mundo3d.js: `zonaEn` x>4000 → 'eter'; `alturaEn` lo delega.
- `enCueva` ahora es `2800 <= x < 4000` (antes el Abismo contaba como cueva).
- Servidor: `faccion` (una vez, nv 20), `abismo` (portal del pueblo, sin
  combate), `salirAbismo` (portal del bastión), `caida` (sin isla debajo y
  sin volar → muere). Fuera del límite del mundo en el Abismo; `c.p3` no se
  guarda allí; se revive en el bastión. Los monstruos no salen de su isla
  (`fueraDeIsla`).
- Cliente: mundo/js/abismo.js dibuja islas, bastiones, Núcleo, portales y
  nubes. Cielo/niebla 'eter', panel de objetivo, minimapa de islas, nombres
  enemigos en rojo. El import map de mundo/index.html versiona
  `/mmo/js/abismo3d.js` (mundo3d.js lo importa sin `?v`; así hay una sola
  instancia del módulo).
- Próximo (v262): PvP entre facciones en el Abismo, Puntos del Abismo y rangos.

### PvP de facciones, Puntos del Abismo y rangos (23-oct-2026, `?v=262`)

- abismo3d.js: `RANGOS` (8, por PA), `rangoDe(pa)`, `santuario(x,z)` (islas
  con `base`).
- Servidor: `rival3d(s, id)` sustituye a `rivalDuelo` en atk3/hab3/finCast:
  rival de duelo o enemigo de faccion en el Abismo fuera de santuario.
  `golpeDuelo` sin duelo entre ellos usa `herir(..., {pvp})`: misma defensa que
  el duelo pero sin tope a 1 de vida ni invulnerabilidad; al morir,
  `muertePvP` anuncia la baja en el Abismo y reparte PA (10 + 5×rango de la
  victima, ×0,3 si es 8+ niveles menor; con el grupo cercano ×1,2 repartido);
  la victima pierde la mitad. Invitados no puntuan; 4 bajas puntuables al dia
  por pareja. Elites del Abismo: 3 PA (jefe 10) con ≥10% del daño.
  `infoApariencia.ra` (rango), `datosPropios.pa/bajasPvP`.
- Cliente: `enemigoP/rivalP` (el blanco puede ser un enemigo de faccion),
  rango bajo el nombre en el Abismo, panel con rango y PA, `pvpBaja`.
- Bot de Telegram: botón «🌌 Mundo abierto 3D» en /start y /mmo, comando /mundo.

### Partículas, post-proceso y resolución dinámica (23-oct-2026, `?v=263`)

- mundo/js/particulas.js: `crearParticulas(escena, N, movil)` → `emitir(x,y,z,
  {n,color,vel,vida,tam,grav,sube,plano,radio})` (anillo de N puntos; la
  posicion se calcula en el shader; solo se sube el tramo emitido) y
  `ambiente('luciernagas'|'eter'|'polvo'|'')` (nube que sigue al jugador).
  Ganchos: at3 (chispas), ph (sangre), md3 (estallido), aterrizaje (polvo).
- Calidad alta: EffectComposer (RenderPass → UnrealBloomPass 0,32/0,45/0,92
  a media resolucion → grado: viñeta 0,32 y saturacion 1,08 → OutputPass),
  cargado con import() dinamico desde `three/addons/` (import map).
  `?sinPost=1` lo quita. Medido en el iGPU: ~+4 ms por cuadro.
- `resolucionDinamica`: media de dt; >25 ms baja el pixelRatio 0,1 (hasta el
  60%), <15 ms lo sube; si ya esta al minimo y >28 ms, quita el post-proceso.
- FOV 60→70 segun la velocidad. Numeros de daño en pool (sin crear/borrar
  nodos) con 'pop' de escala y deriva lateral.

### Arte y sonido CC0 de Kenney y OpenGameArt (23-oct-2026, `?v=264`)

- Paquetes (CC0, descargados con permiso del usuario): Kenney Nature Kit,
  Fantasy Town Kit 2.0, Castle Kit, RPG Audio, Impact Sounds; OpenGameArt
  «80 CC0 creature SFX». Créditos en la ayuda del 3D.
- tools/kenney_build.mjs <carpeta de los zips>: lee los GLB, aplica nodos,
  hornea color (factor × paleta PNG en la UV) por vertice y marca `tinte` en
  hojas/hierba → assets/3d/kenney.bin (+ .gz, 225 KB) y kenney.json. 148 modelos.
- mundo/js/kenney.js: `cargarKenney` (gzip con DecompressionStream o el .bin),
  `geo`, `fundir(piezas)`, un MeshLambert plano con tapa.js y tinte por
  instancia solo en hojas; `piezasCasa(nx,nz,sem,techo,pisos)` (paredes del kit
  + tejado a dos aguas y chimenea).
- Flora: `VAR_K` (variantes y tamaño) y LOD: celdas a menos de 80/100/125 m
  (baja/media/alta) con el kit, mas lejos las figuras sencillas. Bosque: 20 →
  7,4 ms por cuadro (iGPU, alta). Nuevos decorados: flor, hongo, hierba, tocon.
- Pueblo (`crearPuebloKit`): casas mirando a la plaza (giro de 180°, misma caja),
  fuente, mercado, carros, faroles del kit y molino con aspas.
- Abismo: `bastionKit` (6 torres, murallas con puertas al portal y al Nucleo,
  asedio); `abismo.solidos` → colisiones del cliente.
- Sonidos: audio/sfx/k/*.mp3 (84, mono, 500 KB, convertidos con ffmpeg).
  `sfxK(base)` elige variante; `vozDe(k)` por tipo de monstruo. Pasos solo
  con menos de 5 voces sonando.
- Arreglos del Abismo: `aguaEn(x)` (sin agua bajo las islas), `aguaCerca`
  cliente y servidor, cielo 'eter' fijo.
- `?sinKenney=1` vuelve a las figuras de siempre.

### Asedio de la Fortaleza del Núcleo (23-oct-2026, `?v=265`)

- abismo3d.js: `ASEDIO` (cada 2 h, desfase :25, 20 min, aviso 2 min),
  `proximoAsedio`, `CENTRO_NUCLEO`, `MURO_NUCLEO`, `PUERTA_NUCLEO` (oeste),
  `MAQUINA` (catapulta 0,3 %/15 s, balista 0,2 %/10 s, trebuchet 0,6 %/30 s
  de la vida de la puerta), `maquinasAbismo()` (posiciones compartidas).
- data.js: `puerta_nucleo` y `guardian_nucleo` con `asedio: true` (fuera del
  bestiario 2D y de la Torre).
- Servidor (mundo3d.js): `revisarAsedio` en tick3d, `iniciarAsedio`
  (puerta 40k + 8k × jugadores del Abismo; guardian 30k + 10k ×, dormido),
  `caeAsedio`, `terminarAsedio(ganador)` (dueño en storage 'nucleo', premios
  ≥0,3 %, 2 al dia; defensores en la isla si resiste), `dispararMaquina`.
  `danar3d(o, dmg, s, forzar)`: puerta/guardian solo los daña el atacante; el
  guardian dormido nada. `o.persiste` (jefe mundial y asedio) sustituye a
  `o.mundial3` en correa/curacion/retirada. `/asedio` para GM.
  `asedioAuto = false` en el arnes (no depende de la hora real).
- Cliente: muralla del Nucleo con el kit (hueco oeste, 4 torres, banderas
  del color del dueño: `abismo.dueno(f)`), `modeloPuerta()` (reja entre dos
  torres; se hunde al caer; `solidosExtra` cierra el paso), disparos en arco
  con estallido, panel del asedio, punto en el minimapa, E en las maquinas.
- Arnes: 20 pruebas nuevas (730).

### Telegram nativo y arranque sin tirones (23-oct-2026, `?v=266`)

- Bot API 8.0: `requestFullscreen()` en android/ios; `safeAreaInset` +
  `contentSafeAreaInset` → `--tg-top/--tg-bot` y `body.tgfs` (margin-top/bottom
  en el HUD). Colores de cabecera, fondo y barra inferior.
- `vib(t)`: HapticFeedback (golpe light/medium, herida rigid, nivel success,
  muerte error, baja PvP heavy, botin success), como mucho cada 70 ms.
- `TG.BackButton` visible solo con una ventana abierta; la cierra.
- `deactivated/activated`: musica y AudioContext en pausa.
- Nivel: `subiNivel(lv)` (particulas, sonido, presumir cada 5, acceso directo
  a nivel 5 con la misma marca `dq_tg_inicio` que el 2D).
- Compartir: `shareToStory` (7.8) con assets/promo/historia_{1,2,3}.jpg
  (1080×1920, hechas de las tomas del video); widget_link solo para premium
  (la API lo exige), si no el enlace va en el texto. Sin Telegram:
  t.me/share o navigator.share. Pide el codigo de amigo (`amigos`).
- `render.compileAsync(escena, camara)` en la carga (max 4 s).
- mundo/manifest.json (PWA, pantalla completa) y apple-touch-icon.

### Duende y skins fieles al 2D (23-oct-2026, `?v=267`)

- modelos.js: `partesOjos2D` (ojo rasgado, iris ambar, pupila, ceja de piel
  fruncida), nariz 'gancho', orejas 0,56 mas horizontales (`orejaRot`),
  `manoG` 1,18; cara 5 conserva los ojos grandes y la nariz de bola.
- `formaDuende`: hombros, pulgares, punteras, boca ancha con 4 dientes.
- `ROPA_SKIN` + `vestirSkin(r, R0, cpo, tocado)` → devuelve el tocado: capucha
  (tactico, necro), tunica con ribete (necro, juez), ribetes neon (rey),
  codigo (tactico), peluca (sin pelo), chorrera, ojos que brillan, orbe que
  gira, humo, anillos de runas, teclado holografico, movil, mazo, gemas de la
  corona, hombreras con puas, katana de neon (legendaria).

### El 3D a la vista (23-oct-2026, `?v=268`)

- 2D (mmo/): boton `.bt3d` con brillo; boton grande en el inicio; aviso
  `#nuevo3d` con video (assets/video/promo3d.mp4, 540×960, 1,3 MB) tras
  'bienvenido' hasta visitar el 3D (`dq_visto3d`, lo pone mundo.js) o
  cerrarlo en la sesion (`dq_cerro3d`).
- Portada: el boton principal lleva al 3D y el video del 3D en el hero.
- Hub de Telegram: tarjeta «Mundo abierto 3D · NUEVO» encima del MMO
  (`irMundo()` pasa el hash con la sesion de Telegram).

### Retencion en el 3D: racha diaria y pase (23-oct-2026, `?v=269`)

- 'login' → `mostrarDiario(m)`: panel lateral `v-diario` (se cierra a los
  12 s) con los 7 dias de LOGIN_PREMIOS, hoy resaltado y el premio de manana.
- Pase: boton `#b-pase` con contador de niveles por cobrar (`marcaPase`),
  panel lateral `v-pase` (`pintarPase`: nivel, dias que quedan, barra,
  fuentes de puntos y los 20 premios de `premioPase` con «Cobrar» →
  {t:'pase', n}). 'pase' del servidor actualiza yo.pase.
- #botones con flex-wrap y ancho maximo.

### Hermandades y ranking en el 3D (23-oct-2026, `?v=270`)

- Paneles laterales `v-herm` (`pintarHerm`) y `v-rank` (`pintarRankPanel`).
  Mensajes ya existentes del servidor: herm, hermCrear, hermInvitar,
  hermResp, hermSalir, hermExpulsar, hermRango, hermMotd, hermColor, ranking.
- 'hermInv' usa la tarjeta #invit3 (`invitTipo = 'herm'`); boton
  «🛡 Hermandad» en el marco del jugador (lider/oficial, sin hermandad).
- Chat `/h` → canal 'hermandad' (verde). Etiqueta `<nombre>` bajo el nombre
  (hn/hc de infoApariencia; propia desde hermInfo).

### $DUENDE CLASSIC y $DUENDE ORIGINS (23-oct-2026, `?v=271`)

- Portada: tarjetas `.juegos` (ORIGINS con video + boton de sonido, CLASSIC con
  captura) y franja `.una-skin` (tambien en la tienda #nft-store).
- assets/video/promo3d.mp4 con audio AAC (montar.py v4: tarjeta final
  «$DUENDE ORIGINS» y toma «Una skin, dos juegos»).
- mmo/index.html: titulo, carga e inicio «$DUENDE CLASSIC»; aviso del 3D con el
  nombre ORIGINS. mundo/index.html y manifest: «$DUENDE ORIGINS».
- Tiendas 2D (client.js) y 3D (ventanas.js): «Una skin, dos juegos».
- Telegram (bot y hub) sin cambios, a peticion del usuario.

### Inicio para elegir juego (23-oct-2026, `?v=272`)

- inicio/index.html: pagina autocontenida (sin JS externo): fondo de motas en
  canvas con parallax, aurora CSS, cartas que se inclinan al puntero
  (ORIGINS con promo3d.mp4 mudo, CLASSIC con duende_anim.png cuadros 1-9),
  saludo con dq_mmo_nombre, jefe mundial (:00/:30, 10 min) y conectados
  (GET /mmo/ws). Los enlaces llevan el hash.
- ⌂ del 3D y del 2D → /inicio/ (en Telegram el 2D sigue al hub de Telegram).
- Portada: nav «Jugar» y «Jugar gratis ahora» → /inicio/.

### Mejoras del informe de 50 agentes (23-oct-2026, `?v=273`)

- PvP sin pay-to-win: `statsSinSkin(s)` (world.js); `golpeDuelo` ataca con
  atk/crit sin skin y `herir` (duelo/pvp) usa la defensa sin skin y escala por
  maxHp/maxHpSinSkin (la vida extra no alarga el combate). Pruebas: stats
  iguales y daño medio igual con legendaria y comun.
- BUG: recibir3d no enrutaba pase, amigos, herm*, contactos, inspeccionar,
  boveda, chicha, wallet → añadidos. Prueba de servidor del flujo social 3D.
- Tareas: `tareasPosibles()` (<6 conectados: sin 'grupo' ni 'mundial'),
  `cambiarTarea` (1 al dia, `dia.cambio`); en el 3D los monstruos llevan
  `mapa` (tarea de zona) y `dar()` recibe el tamaño real del grupo.
- Pase: puntos x2 si p < dia*50; `pasePend` + `cobrarPasePendiente` al entrar;
  `darPremioPase` compartido.
- UI: misiones del dia/semana con 🔄 en el seguimiento del 3D y en el registro
  del 2D; nota de PvP justo en las dos tiendas.

### Maestria (23-oct-2026, `?v=274`)

- data.js: `MAESTRIA_XP` (la mitad de la XP de un nivel 60) y
  `premioMaestria(n)` (1500 + 50n oro; cada 5, objeto epico).
- world.js: `sumarXp` en NIVEL_MAX → `sumarXpSemana` + `sumarMaestria`
  (c.mae = {n, p}; evento 'mae'; aviso global cada 10). datosPropios y
  datosCaza mandan xp/xpSig de la maestria y `mae` en el nivel maximo.
- tareas.js: la XP de las tareas cuenta siempre (va a la maestria en el 60).
- Clientes: «Nv 60 ★n» (3D) y «60★n» (2D), aviso y efecto al subir.
