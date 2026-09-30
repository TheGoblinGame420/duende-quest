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
