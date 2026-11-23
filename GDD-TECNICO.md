# Duende Quest — Documento de arquitectura y diseño (GDD técnico)

Fecha: 22-nov-2026 · versión del juego: 406 · documento interno (los `*.md` no se publican).

Este documento es un **plan**: no cambia código. Cada fase de la sección 7 se puede ejecutar por separado y trae su criterio de «hecho». Los números del juego salen del código (`mmo/js/data.js`, `functions/mmo/*`); los del mercado llevan su fuente y su grado de confianza.

---

## 0. Cinco premisas del encargo que no coinciden con el juego real

El texto del encargo describe un juego genérico. Antes de planificar hay que corregir esto, porque cambia qué fases tienen sentido:

| El encargo supone | La realidad del repo | Consecuencia |
|---|---|---|
| Una base de datos SQL con tablas de jugadores | Cada personaje es un objeto `c:<uid>` en el almacenamiento de **un Durable Object** de Cloudflare. Supabase solo se usa para el inicio de sesión web y para tablas del arcade y del bot | «Esquema de base de datos» = esquema del personaje + claves del Durable Object (sección 2). RLS solo aplica a las tablas de Supabase |
| Hay que «refactorizar a servidor autoritativo» | El MMO **ya lo es**: daño, botín, oro, XP, compras, forja y probabilidades se calculan en `world.js` y sus módulos. El cliente solo decide su posición, y el servidor la acota | No hay refactor grande. Hay cuatro huecos concretos (sección 6) |
| Validación con Zod/Joi | El proyecto no tiene `package.json` ni empaquetador: se despliega tal cual | Validador propio pequeño, sin dependencias (fase A4) |
| Webhooks de pago y facturación automática | Los pagos son por pedido con monto único y verificación en la cadena, o por Telegram Stars. La entrega es manual salvo los tres gastos en $DUENDE. El dueño es persona natural | No se promete facturación automática. Se propone un registro de ventas exportable (fase C4) |
| Faltan pase, rachas, logros, eventos, rankings, referidos | **Existen todos** (sección 1.3) | El trabajo es medir, unir y cerrar huecos, no construir desde cero |

Regla que guía el plan (la de las recomendaciones añadidas): **no programar todo antes de medir**. El MVP blindado ya está en producción; lo que falta para decidir con datos es un contador del flujo de moneda y un tablero semanal. Por eso la fase A empieza ahí.

---

## 1. Auditoría: qué es Duende Quest hoy

### 1.1 Stack y flujo

- **Servidor:** un Cloudflare Worker (`worker.js`) y un único Durable Object `MmoWorld` que simula el mundo a 10 Hz. Lleva el 2D (CLASSIC), el 3D (ORIGINS) y Chicha Wars.
- **Clientes:** Canvas 2D propio (`mmo/js/client.js`) y Three.js (`mundo/js/mundo.js`). Un WebSocket JSON por jugador. Mini App de Telegram y web instalable.
- **Identidad:** Telegram (`tg:`), correo con Supabase Auth (`web:`) o invitado (`inv:`). Una cuenta puede unir las tres.
- **Flujo del jugador nuevo:** portada → «Jugar ahora» → entra como invitado sin registro → tutorial guiado (5 pasos en 2D, 6 en 3D) → primera misión de caza. A los 3 minutos se le recuerda crear cuenta.

### 1.2 Núcleo actual

Cazar monstruos de tu zona → oro, XP y equipo → subir de nivel y mejorar → zonas, mazmorras y jefes más difíciles. Nivel máximo 60, 4 clases, 10 zonas 2D, mundo abierto 3D.

Tres números que sitúan el ritmo (calculados con `xpParaSubir` y `statsMonstruo`):

| Hito | XP acumulada | Cazas a tu nivel, sin bonos ni misiones | Oro por caza |
|---|---|---|---|
| Nivel 11 | 5.707 | 180 | 22 |
| Nivel 31 | 141.139 | 1.601 | 62 |
| Nivel 60 | 1.289.682 | 7.534 | 120 |

Las misiones, la caza del día y el descanso recortan bastante esas cifras; no hay medición real de cuánto (ver fase A1).

### 1.3 Sistemas que ya existen

| Sistema | Estado | Dónde |
|---|---|---|
| Racha de inicio de sesión (7 días, hitos a 14/21/30, protectores) | Existe | `procesarLogin`, `LOGIN_PREMIOS` |
| Tareas: 3 diarias y 2 semanales, cofres a 4/8/12 puntos | Existe | `tareas.js` |
| Pase mensual gratis: 20 niveles × 75 puntos | Existe, **sin pista de pago** | `PASE`, `pase.js` |
| Logros (~100), bestiario, maestría tras el nivel 60 | Existe | `LOGROS` |
| 17 temporadas con fechas hasta navidad de 2027 | Existe | `TEMPORADAS` |
| Rankings: XP semanal con ligas, torre, desafíos, niveles 2D+3D, duelos | Existe | `ranktodos.js`, `duelos.js` |
| Bóveda semanal, XP de descanso, buzón «mientras no estabas» | Existe | `world.js` |
| Referidos con premio al llegar el amigo a nivel 10 y controles contra multicuentas | Existe | `amigos.js` |
| Avisos por Telegram con consentimiento | Existe | `retencion.js` |
| Tienda: oro, kit, skins, alas; pack de bienvenida US$1,99 de una sola vez | Existe | `PAQUETES` |
| Tres gastos en $DUENDE con registro de quema | Existe (v404) | `gastos.js` |
| Mascotas místicas, criaturas capturables, vecinos, hermandades, facciones | Existe | varios |
| Telemetría: ~60 pasos de embudo, retención por cohorte (día 1, 7, 14, 30) con intervalo de confianza, embudo de compra | Existe | `retencion.js` |
| **Contador del flujo de oro por fuente y por gasto** | **No existe** | — |
| **Comercio entre jugadores o casa de subastas** | **No existe** | — |
| **Pista de pago del pase, ofertas por nivel, aceleradores** | **No existen** | — |

---

## 2. Esquema de datos real

### 2.1 Claves del Durable Object

| Clave | Contenido |
|---|---|
| `c:<uid>` | El personaje completo (2.2) |
| `al:<uid secundario>` | Alias hacia el personaje principal (cuentas unidas) |
| `dt:<sha256>`, `dtl:<uid>` | Sesiones de aparato (cookie `dq_s`) |
| `pedidos`, `firma:<firma>` | Pedidos de la tienda y firmas ya usadas (anti-repetición) |
| `retiros`, `fondo`, `quema` | Retiros de mTON, fondo y registro de quema |
| `ranking`, `ret:dia`, `ref:*`, `bz:<uid>`, `h:<id>` | Rankings, retención, referidos, buzón, hermandades |
| `cw:<uid>`, `cwm`, `cwr` | Chicha Wars: partida, mercado y ranking |

### 2.2 El personaje, por grupos

| Grupo | Campos principales |
|---|---|
| Identidad | `uid`, `nombre`, `creado`, `vinc`, `modos` |
| Progreso | `nivel`, `xp`, `clase`, `tal`, `mis`, `logros`, `kills`, `jefes` |
| Bolsillo | `oro`, `bolsa`, `eq`, `pw` (consumibles), `mat`, `forja` |
| Colección | `skins`, `armas`, `monturas`, `alas`, `tintes`, `mascotas`, `mascota`, `cri`, `huevo`, `petNv` |
| Retención | `login`, `tareas`, `pase`, `descanso`, `v2` |
| Dinero real | `mton`, `mtonTotal`, `wallet`, `compro` |

### 2.3 Lo que propongo cambiar en los datos

1. **Versión de esquema en el personaje (`c.v`) y un único normalizador al cargar.** Hoy cada módulo arregla sus campos por su cuenta (`huevoAlEntrar`, `criaturasDe`…). Un normalizador con versión hace seguras las migraciones y las copias restauradas.
2. **Pedidos, firmas y libro mayor en tablas SQL dentro del propio Durable Object.** La clase se creó como SQLite (`new_sqlite_classes`), así que el objeto tiene una base SQL propia. Una restricción `UNIQUE` sobre la firma haría que la repetición de un pago la rechace la base y no el código. Antes de implementarlo hay que confirmar la API en la documentación de Cloudflare y dar soporte SQL a `tools/mmo_local.mjs`, que hoy simula el almacenamiento en memoria.
3. **No mover los personajes a Supabase.** El combate necesita el estado en memoria; duplicarlo en Postgres añade latencia y dos fuentes de verdad.

---

## 3. Benchmark: cuatro referentes

Elegidos por parecido real con el núcleo (MMO de caza y progresión, en navegador, con token opcional). **Ninguno publica su retención a 1, 7 y 30 días**; quien diga cifras exactas por juego las está inventando. Como referencia general, el informe de GameAnalytics de 2025 da de mediana 22 % al día 1, 4 % al día 7 y 0,7 % al día 30, y para el 10 % mejor unos 40 %, 12 % y 4 %.

| Juego | Por qué sirve | Núcleo adictivo | Retención | Economía y dinero |
|---|---|---|---|---|
| **MapleStory** (Nexon) | Es el género de CLASSIC: MMO 2D lateral de caza | Cazar en mapas pequeños con respuesta inmediata, subir de nivel, mejorar equipo con riesgo | Diarias y semanales por jefe, eventos de calendario casi continuos con moneda propia, límites semanales que marcan la rutina | Cosméticos y comodidad. La franquicia es una de las tres que suman ¥330.700 millones en 2024 según Nexon; la versión global creció 24 % |
| **Old School RuneScape** (Jagex) | Economía de MMO más estudiada; nació en navegador | Metas largas y visibles (habilidades), progreso que nunca se pierde | Tareas diarias opcionales, ligas temporales con reglas nuevas, votaciones de la comunidad | Suscripción, y bonos comprables con dinero que se venden por oro dentro del juego. Sumideros fuertes: impuesto al mercado y objetos que se destruyen. Sin cifras verificadas aquí |
| **Pixels** (Ronin) | MMO social en navegador con token | Energía limitada que se gasta en tareas cortas; tablón de pedidos que cambia | Tablón diario, gremios, eventos; membresía VIP | Moneda blanda fuera de la cadena y un solo token para lo premium. Dijo superar 1 millón de usuarios diarios en mayo de 2024; medios independientes atribuyeron buena parte a bots y cazadores de airdrop |
| **Archero** (Habby) | Meta-progresión y monetización móvil de referencia | Partidas de 5-10 minutos con elecciones de poder al azar | Energía, cofres con temporizador, pase de batalla, eventos rotativos | Talentos y equipo que se fusiona, packs de inicio, revivir pagando. Entre US$264 y 376 millones según la fuente (neto o bruto); hizo el 30 % en sus primeros 10 meses |

Descartado como referente principal: **Sunflower Land** (granja, sin combate). Su lección útil es de seguridad: límites de retiro y detección de bots desde el primer día.

### Qué copiar y qué no

| Lección | De quién | Estado en Duende Quest |
|---|---|---|
| Un tablón diario único que diga «hoy haz estas 3 cosas» | Pixels, MapleStory | Las piezas existen separadas (tareas, caza del día, vecinos, pase). **Falta unirlas en una sola pantalla** |
| Moneda blanda dentro, token solo para lo premium | Pixels | Ya es así (oro y $DUENDE). Mantener |
| Sumideros permanentes para el veterano | RuneScape | **Hueco real** (sección 4.3) |
| Pase con pista gratis y pista de pago | Archero, todos | La pista gratis existe; **la de pago es el ingreso recurrente que falta** |
| Mejora de equipo con riesgo | MapleStory | Hoy la forja siempre sale bien hasta +10. Añadir riesgo solo por encima de +10 |
| Dinero por jugar sin límites | Pixels (bots) | **No copiar.** El mTON ya tiene topes, edad mínima y aprobación manual |
| Energía que impide jugar | Archero, Pixels | **No copiar** en un MMO: corta la sesión. El XP de descanso cumple la misma función sin bloquear |

---

## 4. Motor económico

### 4.1 Fuentes de oro (lo que entra)

| Fuente | Fórmula | Peso estimado |
|---|---|---|
| Caza | 2 + 2·nivel por monstruo; jefe ×25 | Principal |
| Misiones de la cadena (41) | de 80 a 60.000 por misión | Alto al subir, nulo al terminar |
| Caza del día | 40·nivel | Medio |
| Inicio de sesión (7 días) | 300 a 3.000, por nivel/10 y semana de racha | Medio |
| Mazmorra diaria, torre, expediciones, pesca, vecinos | 150·nivel; 40·nivel por cofre; 40·nivel·h^0,75 | Medio |
| Eventos, jefe mundial, rankings semanales | variables | Bajo, concentrado en pocos |
| Paquetes de oro | 7.000 de oro por dólar en el mejor paquete | Depende de las ventas |
| Chicha Wars | hasta 1.000 al día por cuenta | Bajo, pero ver 6.1 |

### 4.2 Sumideros (lo que sale)

| Sumidero | Costo | Tipo |
|---|---|---|
| Forja de un arma hasta +10 | 42.986 en total | Una vez por arma |
| Skins con oro (12) | 263.000 en total | Una vez |
| Monturas, alas, tintes y mascotas | 576.000 + 196.000 + 1.050.000 + 1.075.000 | Una vez |
| Runas | 2.500·rango² más materiales | Una vez por runa |
| Reforja a nivel 60 | precio·5·(1 + 0,25·veces) | **Recurrente** |
| Pociones y poderes | 30 a 350 | **Recurrente**, pequeño |
| Viaje, revivir a nivel 60, cambio de clase, reinicio de talentos | 20·zona; 5·nivel; 200·nivel; 100·nivel | Recurrente, pequeño |

### 4.3 Diagnóstico

- **Al subir no hay inflación.** Cazando hasta el 60 entran unos 640.000 de oro por caza (la relación oro/XP ronda 0,5), y solo los cosméticos piden cerca de 3,2 millones. El jugador que sube siempre tiene en qué gastar.
- **El riesgo está en el veterano.** Quien ya compró todo gana 120 por caza y casi no tiene gasto recurrente salvo la reforja. Ese oro se acumula. Hoy no hace daño porque no hay comercio entre jugadores; lo haría el día que se abra un mercado.
- **No sabemos cuánto oro entra y sale de verdad.** Ninguna de las cifras de «peso» de arriba está medida. Es el dato más importante que falta y se obtiene con poco código (fase A1).

### 4.4 Reglas de balance propuestas

1. **Razón gasto/ingreso semanal entre 0,85 y 1,0 en el tramo de nivel 60.** Por debajo de 0,85 se añade o abarata un sumidero; por encima de 1,0 se revisa que el nivel 60 no se sienta pobre.
2. **Oro por hora con techo observable:** alerta al dueño si una cuenta gana más que el percentil 99 de su nivel durante 3 días seguidos.
3. **Ningún sumidero nuevo antes de tener dos semanas de datos del libro mayor.**
4. **Candidatos, por orden de preferencia:**
   - forja de +11 a +15 con probabilidad de fallo (el arma nunca se rompe; se pierde el oro y los materiales);
   - subir de nivel a la mascota con oro y materiales además de con $DUENDE;
   - mejoras de hermandad pagadas entre todos;
   - impuesto del 5 % si algún día hay mercado.
5. **Sin durabilidad ni reparación periódica:** castiga al jugador casual, que es el público de Telegram.

---

## 5. Monetización

### 5.1 Lo que hay

Paquetes de oro (US$1, 5, 20), kit (US$3), pack de bienvenida (US$1,99, una vez), skins y alas (US$1 a 50), y tres gastos en $DUENDE (US$0,50 a 1). Métodos: Telegram Stars, SOL, $DUENDE con 10 % de descuento, y Yape preparado pero apagado.

### 5.2 Qué añadir, por orden de retorno esperado

| # | Propuesta | Precio orientativo | Regla de balance |
|---|---|---|---|
| 1 | **Pista de pago del pase mensual**: mismos 20 niveles, premios extra cosméticos y de comodidad | US$3 a 5 por temporada | Nada de poder de combate exclusivo. El oro de la pista de pago no supera el de un paquete del mismo precio |
| 2 | **Ofertas por hito**: una oferta única al llegar a nivel 10, 20 y 40 | US$2 a 5 | Una vez por cuenta, sin cuenta atrás falsa (publicidad honesta) |
| 3 | **Activar Yape/Plin** para Perú | — | Ya está programado; falta el número del dueño |
| 4 | **Acelerador de XP** (+50 % durante una hora) | US$1 o con oro | No cuenta para el ranking semanal de XP, o el ranking deja de ser justo |
| 5 | Segunda tanda de skins de temporada | US$3 a 10 | Solo aspecto |

El precio del pase y de las ofertas es decisión del dueño; los rangos son los habituales del género, no una predicción de ventas.

### 5.3 Arquitectura de pagos

- **Estados de un pedido (ya existen):** `esperando_pago` → `comprobando` → `por_verificar` o `pagado` → `entregado`; además `vencido`, `anulando` y `anulado`.
- **Idempotencia (ya existe):** monto único por pedido, firma guardada en `firma:<firma>`, cerrojo `pd.entregando`.
- **Pasarela única del MVP:** Telegram Stars para quien entra por Telegram y $DUENDE/SOL para la web. No se añade pasarela de tarjetas (regla del dueño).
- **Reembolsos:** el estado `anulado` cubre el caso; la devolución de Stars se hace desde el bot, que hoy no se toca.
- **Facturación:** no se automatiza. Se propone un registro mensual de ventas exportable para el contador, y entregar comprobante a quien lo pida.
- **Hueco abierto:** una misma transacción de Solana podría valer en el arcade y en el MMO, porque cada uno guarda sus firmas por separado.

---

## 6. Seguridad y arquitectura: huecos por prioridad

El MMO ya calcula todo en el servidor, limita a 60 mensajes por segundo, expulsa a los 200 y escapa el texto que pinta. Compras, forja, talentos, viaje y retiros comprueban y escriben sin esperas en medio. Lo pendiente:

| # | Gravedad | Hueco | Arreglo |
|---|---|---|---|
| 6.1 | **Media** | **Chicha Wars confía en el cliente.** El saldo de monedas llega en la petición (`limpiarEst` solo lo recorta) y se cambia por oro del MMO, con tope de 1.000 al día. Cualquier cuenta puede fabricar ese oro sin jugar | Llevar la partida al servidor, o cortar el cambio a oro hasta entonces. Decisión del dueño |
| 6.2 | Baja | En `cambiar`, `vender` y `comprar` de Chicha Wars hay esperas entre la comprobación y la escritura | Apuntar el gasto antes de la primera espera (reservar y luego aplicar) |
| 6.3 | Media | Firmas de pago separadas entre arcade y MMO | Un solo registro de firmas (encaja con 2.3, punto 2) |
| 6.4 | Media | Un solo Durable Object sin hibernación: un error afecta a todos y cobra tiempo mientras haya alguien conectado | Hibernation API, como tarea aparte (toca todas las sesiones) |
| 6.5 | Baja | El secreto interno reutiliza el token del bot y se compara sin tiempo constante | Secreto propio y comparación segura. Requiere que el dueño cree el secreto |
| 6.6 | Media, sin verificar | Tablas `referrals`, `donations` y `players` de Supabase sin políticas en el repo; scripts SQL antiguos que reabren permisos si se vuelven a ejecutar | El dueño ejecuta `sql/00-diagnostico.sql` (solo lectura) y se retiran los scripts viejos |
| 6.7 | Baja | La posición la manda el cliente, acotada por presupuesto de distancia | Aceptado; vigilar con el contador de anomalías |
| 6.8 | Baja | La política de contenido (CSP) solo limita quién puede incrustar la página | CSP de scripts en modo informe primero, para no romper TON Connect ni la Mini App |

Sobre los puntos del encargo que no aplican tal cual:

- **Transacciones atómicas:** un Durable Object atiende un mensaje a la vez. La regla práctica es «comprobar y escribir sin `await` en medio; si hay una llamada externa, reservar antes». Se propone una prueba del arnés que lo vigile en las funciones de dinero.
- **CSRF:** la cookie de sesión es `SameSite=Lax` y las rutas de sesión comprueban el origen.
- **Inyección SQL:** el juego no arma consultas con texto del jugador; las tablas de Supabase se consultan con parámetros desde el servidor.

---

## 7. Plan por fases

Tamaños: S (horas), M (una sesión larga), L (varias sesiones). Cada fase pasa `node tools/verificar.mjs` y sigue el flujo de publicación de siempre.

### Fase A — Datos y motor económico (empezar aquí)

| Paso | Qué | Hecho cuando | Tamaño |
|---|---|---|---|
| A1 | **Libro mayor agregado**: cada entrada y salida de oro, XP y mTON suma a un contador diario por fuente (`eco:dia`). No guarda un registro por evento | El dueño ve en su panel: oro creado y gastado por fuente, razón gasto/ingreso y oro medio por jugador activo, por día y por tramo de nivel | M |
| A2 | Versión de esquema `c.v` y normalizador único | Un personaje antiguo, uno roto y una copia restaurada pasan por el mismo camino, con pruebas | M |
| A3 | Cerrar Chicha Wars (6.1 y 6.2) | Una partida inventada no produce oro; prueba en el arnés | M, tras decisión del dueño |
| A4 | Validador de mensajes sin dependencias: tabla de tipo y rango por mensaje, aplicada en el despacho | Todo mensaje con forma inválida se descarta antes de llegar a las reglas; prueba que recorre los 114 tipos | M |
| A5 | Registro único de firmas de pago (6.3) | La misma firma no vale dos veces en ningún sistema | S-M |

### Fase B — Telemetría para decidir

| Paso | Qué | Hecho cuando | Tamaño |
|---|---|---|---|
| B1 | Tablero semanal: retención por cohorte, embudo de los primeros 60 segundos, conversión por paquete, flujo de oro | Una sola pantalla o mensaje semanal al dueño | M |
| B2 | Tiempo hasta la primera recompensa (los pasos `golpe1` y `caza1` ya se registran) | Se conoce la mediana real y el punto de mayor abandono | S |
| B3 | Alerta de anomalías: oro por hora sobre el percentil 99, cuentas nuevas con el mismo aparato | El dueño recibe el aviso por Telegram | S-M |

### Fase C — Monetización (después de dos semanas de datos de A1)

| Paso | Qué | Hecho cuando | Tamaño |
|---|---|---|---|
| C1 | Pista de pago del pase | Se compra, se entrega y sus premios no dan poder; arnés | M-L |
| C2 | Ofertas por hito | Una vez por cuenta, sin urgencia falsa | M |
| C3 | Activar Yape/Plin | El dueño pone su número y prueba un pago | S |
| C4 | Registro mensual de ventas exportable | Archivo por mes con fecha, producto, método y monto | S |

### Fase D — Juego y retención (según lo que digan los datos)

| Paso | Qué | Tamaño |
|---|---|---|
| D1 | Pantalla «Hoy»: une tareas, caza del día, vecinos y pase, con un botón de cobrar todo | M |
| D2 | Primer minuto: recortar pasos del tutorial donde B2 muestre abandono | S-M |
| D3 | Sumidero para veteranos elegido con A1 (forja +11 a +15 es el candidato) | M |
| D4 | Respuesta visual y sonora en compras y cobros | S |

### Fase E — Infraestructura y seguridad restante

| Paso | Qué | Tamaño |
|---|---|---|
| E1 | Secreto interno propio (6.5) | S, con el dueño |
| E2 | Diagnóstico y limpieza de SQL de Supabase (6.6) | S, con el dueño |
| E3 | CSP de scripts en modo informe (6.8) | M |
| E4 | Hibernation API (6.4) | L |

### Fase F — Adquisición y operación

| Paso | Qué | Quién |
|---|---|---|
| F1 | Videos cortos semanales con el kit que ya existe (`tools/promo`, `_promo_kit`) | Dueño publica; se pide confirmación antes de publicar en su nombre |
| F2 | Calendario de eventos: ya hay 17 temporadas; falta anunciarlas con antelación | Dueño |
| F3 | Comunidad: Telegram ya existe; Discord solo si hay quien lo modere | Dueño |
| F4 | Referidos: revisar el premio con los datos de B1 | Tras B1 |

---

## 8. Decisiones que solo puede tomar el dueño

1. Chicha Wars: llevar la partida al servidor o cortar el cambio a oro mientras tanto.
2. Precio de la pista de pago del pase y qué premios lleva.
3. Número de Yape/Plin y si se activa.
4. Si el acelerador de XP entra, y si excluye al comprador del ranking semanal.
5. Ejecutar `sql/00-diagnostico.sql` en Supabase y crear el secreto interno nuevo.

## 9. Lo que este documento no afirma

- No hay datos de retención propios aquí: existen en el servidor de producción, pero no se han leído para este plan.
- Los pesos de las fuentes de oro son estimaciones hasta que A1 mida.
- Las cifras de mercado son de terceros y varían según la fuente.

## 10. Fuentes del benchmark

- Pixels y usuarios diarios: The Block, 13-may-2024, https://www.theblock.co/post/294058 ; crítica sobre bots: Cointelegraph Magazine, https://cointelegraph.com/magazine/bots-airdrops-push-ronin-to-no-2-blockchain-for-daily-users-not-pixels-fans/
- Pixels y usos del token: CoinMarketCap Academy, https://coinmarketcap.com/academy/article/what-is-pixels-the-social-web3-game-built-on-ronin
- Archero, ingresos y descargas: Game World Observer, https://gameworldobserver.com/2025/01/20/archero-2-revenue-8-million-in-11-days-vs-original-game ; PocketGamer.biz, https://www.pocketgamer.biz/archero-2-makes-328m-in-first-30-days-from-player-spending
- Archero, monetización: Udonis, https://www.blog.udonis.co/mobile-marketing/mobile-games/archero-monetization ; Deconstructor of Fun, https://www.deconstructoroffun.com/blog/2025/7/31/habbys-hybridcasual-empire-the-template-that-built-a-powerhouse
- Nexon y MapleStory 2024: Business Wire, https://www.businesswire.com/news/home/20250213367493/en/Nexon-Releases-Earnings-for-Fourth-Quarter-and-Full-Year-2024
- Retención de referencia: GameAnalytics 2025, resumen en https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks
- Old School RuneScape: descripción de memoria, sin fuente consultada en esta sesión.
