# Duende Quest — mapa técnico para Claude (Fase 0, auditoría del 17-nov-2026)

> Documento interno. `*.md` está en `.assetsignore`, así que **no se publica**.
> Reglas del dueño (siguen vigentes, no se negocian):
> - No tocar el token $DUENDE, el staking, las donaciones, la verificación de pagos SOL/$DUENDE/Stars ni los precios.
> - Los pagos son manuales: el dueño entrega con `/entregar` o con el Modo Dios.
> - El bot de Telegram no se toca: queda estable.
> - Probar con el sonido apagado: `localStorage dq_mmo_sonido='0'`.
> - Cada `git push` despliega a producción.
> - Para publicar: `node tools/version.mjs N`, luego `node tools/verificar.mjs`, commit y push, después `node tools/humo_produccion.mjs`, y una fila nueva en `HISTORIAL-DUENDE.md`.
> - Contexto largo: `HISTORIAL-DUENDE.md` y `SIGUIENTE.md` (búscalo con grep, es enorme).

---

## 1. Piezas y despliegue

| Pieza | Archivo | Qué hace |
|---|---|---|
| Worker de entrada | `worker.js` | Enruta `/api/*`, `/mmo/ws`, `/mmo/ev`, `/mmo/cw` y `/api/mantenimiento`. Todo lo demás son estáticos. |
| Configuración | `wrangler.toml` | `[assets] directory="."`: **la raíz entera es pública salvo lo que liste `.assetsignore`** (es una lista negra). `run_worker_first` solo para rutas dinámicas. Un único DO `MMO` → clase `MmoWorld` (SQLite, plan gratuito). |
| Servidor del MMO | `functions/mmo/world.js` (4149 líneas) + ~30 módulos mezclados con `Object.assign` sobre el prototipo (`combate.js`, `mazmorras.js`, `mundo3d.js`, `dios.js`, `social.js`...) | Un solo Durable Object, `idFromName('mundo-1')` (`worker.js:83`), lleva el 2D (CLASSIC), el 3D (ORIGINS) y el HTTP de Chicha Wars. |
| Cliente 2D (CLASSIC) | `mmo/index.html` + `mmo/js/client.js` (6492 líneas) | Se apoya en `data.js` (compartido con el servidor), `fondo2d.js` y `marioneta.js`. |
| Cliente 3D (ORIGINS) | `mundo/index.html` + `mundo/js/mundo.js` (10 721 líneas) | El mismo WebSocket `/mmo/ws`, con `hola { modo: '3d' }` (`functions/mmo/mundo3d.js:11`). |
| Datos compartidos | `mmo/js/data.js` | Mapas, monstruos, ítems, `FIS`, `TICK_MS=100`, `SUELO=400` y `VERSION` (hoy 393). Los importan el cliente y el servidor: **cambiar un número aquí cambia las reglas en los dos lados**. |
| Arcade / Mini App antigua | `game.html`, `js/*.js` | Va aparte del MMO. Este sí habla con Supabase directamente desde el navegador. |
| Pruebas locales | `tools/mmo_local.mjs` | Ejecuta el `world.js` real en Node con almacenamiento en memoria, porque `wrangler dev` no corre DOs en esta máquina. Lo usan `tools/arnes_mmo.mjs`, `tools/verificar.mjs`, `qa_*.mjs`, `sim_*.mjs` y `soak_mmo.mjs`. Con el host `localhost`, el cliente expone `window.__dq` (`client.js:6492`). |
| Cache de JS | `?v=N` en los `import` de `client.js` (`data.js?v=393`) y en el HTML | Si cambias un JS sin subir el `?v=`, el jugador sigue con la versión vieja. Para subirlo: `tools/version.mjs`. |

---

## 2. Motor y renderizado 2D (`mmo/js/client.js`)

- **Canvas 2D** sin motor externo: `cv.getContext('2d', { alpha: false })` (`client.js:200`) con `imageSmoothingEnabled=false` (pixel art).
  - Resolución lógica `VW` de 800 (horizontal) o 400 (vertical) (`client.js:196-226`).
  - La cámara sigue al jugador con suavizado `camX += (obj-camX)*.15` (`client.js:5098`).
- **Game loop:** `requestAnimationFrame(bucle)` (`client.js:6458-6489`).
  - **Timestep fijo de 60 Hz:** `PASO = 1000/60` con un acumulador topado en 200 ms (`client.js:6439-6464`).
  - `fisica()` corre N veces por cuadro y `dibujar()` una sola vez, solo si hubo al menos un paso.
  - El jugador propio se dibuja **interpolado** entre `P.px` y `P.x` según `acum/PASO` (`client.js:6468-6473`).
- **Física local:** `fisica()` (`client.js:1290`). Gravedad, dash, coyote time y buffer de salto, `sueloEn(...)` para las plataformas y muros de mazmorra.
- **Otros jugadores y monstruos:** buffer de posiciones con **interpolación** 110 ms en el pasado para los monstruos y 230 ms para los jugadores (`interpolar()`, `client.js:1213`).
- **Culling:**
  - Los monstruos fuera de `[-150, VW+150]` no se dibujan (`client.js:4661`).
  - No se dibujan los jugadores que no llegan en la foto desde hace más de 1,5 s (`fueraDeFoto`, `client.js:1166`).
  - El minimapa se pinta cada 3 cuadros.
  - **Modo ligero:** si la media es inferior a ~36 FPS en dos tandas de 5 s, salen menos partículas y sin mezcla aditiva (`client.js:6445-6456`).
- **Juice existente:**
  - hit-stop: `pausaGolpe` de 50 ms (`client.js:774`);
  - temblor de pantalla: `sacudir` (`client.js:775, 815`);
  - retroceso visual del monstruo: `o.empuje` (`client.js:4659`);
  - partículas, números de daño por color (`COLOR_GOLPE`) y fundido al cruzar portales.
- **Audio:** ya usa **Web Audio** (`client.js:372-436`).
  - SFX en mp3 decodificados una sola vez en `AudioBuffer`. Cada golpe es un `BufferSource` con un anti-spam de 45 ms.
  - Tonos sintetizados con osciladores (`TONOS`).
  - La música es un `<audio>` aparte.
  - Silencio: `dq_mmo_sonido='0'`.
- **UI:** es DOM y no canvas: modales, inventario y equipo (`RANURAS`, `inv-lista`, `client.js:3490`), y la barra de habilidades.
  - Para el texto usa `esc()` (`client.js:5771`). Los nombres que vienen del servidor se escapan antes de llegar a `innerHTML`.

## 3. Flujo de red real

**No hay Supabase Realtime.** El multijugador es **un WebSocket JSON contra un Durable Object**.

1. `new WebSocket(wss://host/mmo/ws)` (`client.js:612`). Pasa por `worker.js:81-89` y llega a `MmoWorld.fetch` (`world.js:305`).
   - Allí se aplican los topes: 300 jugadores, 24 sockets por IP (o por /64 en IPv6), 60 por /48 y 40 sockets sin identificar (`world.js:322-347`).
   - El socket se acepta con `servidor.accept()` (`world.js:353`). **No usa la Hibernation API**, así que el DO se queda en memoria mientras haya alguien conectado.
2. Al abrir, el cliente manda `hola` con un único tipo de autenticación (`world.js:584`):
   - `tg`: `initData` de Telegram verificado con HMAC y validez de 24 h (`world.js:618`, `functions/api/lib.js:208`). El uid queda como `tg:<id>`.
   - `web`: JWT de Supabase Auth verificado contra `/auth/v1/user` (`lib.js:191`). El uid queda como `web:<uuid>`.
   - `inv`: token de invitado de 32 caracteres hex, guardado en el `localStorage` del navegador, más una prueba de trabajo `pow` (`world.js:115-122`). El uid queda como `inv:` + sha256 truncado.
   - Si a los 8 s no llegó el `hola`, el servidor corta la conexión.
3. **El cliente manda intenciones.** El tope es de 60 mensajes por segundo y se expulsa al pasar de 200. Cada mensaje se limita a 4 kB, salvo la copia de seguridad del dueño (`world.js:474-485`). Mensajes:
   - `mv {x,y,f,a}`: se manda solo cuando hay cambios. Al girar o saltar sale enseguida (50 ms); al avanzar, cada 200 ms (100 ms en el aire) (`client.js:1328-1346`).
   - `atk`, `hab`, `pw`, `comprar`, `equipar`, `portal`, `chat`, etc.: el despacho está en `world.js:490-580`.
4. **El servidor simula a 10 Hz** (`TICK_MS=100`, en `tick()`, `world.js:3699`).
   - Agrupa a los jugadores por `s.k`, la clave de su mapa o instancia.
   - Por cada clave, `simularMapa()` (`world.js:3756`) se encarga de:
     - la reaparición de monstruos;
     - la IA (`pensar`);
     - los proyectiles;
     - la regeneración.
   - Después emite **una foto `s` por mapa**: `p` (jugadores), `m` (monstruos), `b` (balas) y `z` (zonas).
   - **Filtrado por zona:**
     - un jugador solo recibe la foto de su mapa (`aClave`);
     - con más de 12 jugadores, a cada uno le llegan solo los que están a menos de `VISTA_2D=1100` px, con un tope de 40, y los lejanos (más de 450 px) en una foto sí y otra no (`world.js:3862-3888`);
     - **monstruos (desde la Fase 1):** cada jugador recibe solo los que tiene a menos de `VISTA_MON=1000` px, y no los suelta hasta pasar los 1250 px (`MARGEN_MON`). Siempre van los jefes, los especiales (`o.ex`) y el más cercano del tipo de su misión (`monstruosDe`). Los que el cliente aún no conoce llegan completos en `mn`; el cliente borra los que dejan de llegar. `s.mv` guarda lo que conoce cada cliente y se reinicia al entrar a un mapa.
   - **Reconciliación (desde la Fase 1):** cada corrección de posición (`corregir()`, mensaje `snap`) lleva un número `n`. El cliente lo devuelve en cada `mv` como `sq`, y hasta entonces `mover()` ignora en silencio las posiciones que ya venían de camino (antes provocaban tirones en cadena). Tiene un tope de 2 s; un cliente viejo sin `sq` sigue con la ventana `snapHasta`.
   - Los eventos sueltos (`at` golpe, `md` monstruo muerto, `pl` jugador que sale, `toast`...) van por `aClave`.
5. **Persistencia:**
   - Cada personaje es un objeto `c` en el **almacenamiento del DO** con la clave `'c:' + uid` (`world.js:709, 3683`). **No está en Supabase.**
   - Se guarda cada 60 s si hubo cambios, la posición cada 5 min y siempre al cerrar (`world.js:154-160, 3652`).
   - El estado global también vive en el DO: `ranking`, `pedidos`, `retiros`, `fondo`, `firma:*`, `ref:*`, etc.
6. **HTTP auxiliar al mismo DO:**
   - `/mmo/ev`: embudo de analítica, validado con una lista blanca en `worker.js:59-75`.
   - `/mmo/cw`: Chicha Wars.
   - `/interno/*`: solo se llega con `stub.fetch` desde el Worker o el cron, con la cabecera `x-interno` (`world.js:1938`).

## 4. Supabase: qué se usa y qué comparten el 2D y el 3D

**El 2D y el 3D no comparten ninguna tabla de juego en Supabase:** comparten el **mismo personaje `c:<uid>` dentro del DO**. Del lado de Supabase, el MMO solo usa:

| Uso | Dónde | Tabla o servicio |
|---|---|---|
| Inicio de sesión web (2D y 3D) | `client.js:566-582`, `mundo.js:2452`; servidor en `lib.js:191` | **Supabase Auth** (`auth.users`); el cliente solo usa `auth.getSession()` |
| Skins compradas en la Mini App (solo cuentas tg) | `world.js:1034` (service role) | `skin_purchases` (lectura) |

El resto de tablas las usan el arcade, el bot, el cron y la wallet, siempre con la service role (`supabaseQuery`, `lib.js:87`):

- `profiles`
- `game_scores`
- `redemptions`
- `referrals`
- `sol_orders`
- `stars_purchases`
- `ton_credits`
- `ton_stakes`
- `withdrawal_requests`
- `tournament_awards`
- las RPC `accrue_dq*`, `redeem_dq*`, `add_duende_by_tgid` y `spend_duende`

El arcade (`js/*.js`), en cambio, sí lee y escribe directamente con la clave anon:

- `profiles` (`js/auth-manager.js:155, 228, 372`);
- `game_scores` (`auth-manager.js:328`);
- `donations` (`js/donation-manager.js:105`);
- `players` (`js/wallet-manager.js:65`).

## 5. Autoridad: servidor frente a cliente

**Lo decide el servidor (`world.js` y sus módulos):**

- vida, daño, críticos y muerte (`herir`, `danar`, `matar`; `combate.js:270` `atacar`, con el enfriamiento, el combo, la caja de alcance y los objetivos calculados en el servidor);
- habilidades, GCD, recursos, auras y lanzamientos (`combate.js`);
- monstruos: reaparición, IA, amenaza y botín (`simularMapa`, `pensar`, `matar`);
- oro, XP, niveles, compras, forja y equipo (`comprar` `world.js:3186`, que valida la cercanía del mercader, el oro y `n` acotado entre 1 y 10; `equipar`);
- misiones, logros, ranking, mazmorras, duelos y hermandades;
- pedidos y pagos: verificación en cadena y entrega manual. **No se toca.**

**Lo calcula el cliente y el servidor lo valida o lo acota:**

- **La posición x/y del propio jugador** (`mover`, `world.js:2319`). El cliente la manda y el servidor:
  - aplica un presupuesto de distancia que se recarga con el tiempo (correr + dash + 80 px);
  - acota la altura con `techoEn` (doble salto);
  - aplica los muros de mazmorra, el aturdimiento y el bloqueo;
  - si algo no cuadra, responde con `snap`.
- La orientación `f` y el estado de animación `a` (0 a 6).
- La predicción visual del golpe (`P.golpePredicho`), que es solo sonido y animación; el daño real llega en `at`.

**Solo lo hace el cliente:** el render, las partículas, el audio, la cámara y la UI.

## 6. RLS en Supabase (según los `.sql` del repo; **no se ha verificado contra la base real**)

| Tabla | RLS | Estado final previsto si se ejecutaron todos los scripts en orden |
|---|---|---|
| `profiles` | Sí (`06-profiles-lectura.sql:35`) | SELECT solo de la propia fila. UPDATE solo en las columnas permitidas (`05-auditoria-oct.sql:32`). Hay un trigger que protege las columnas de dinero (`01-blindaje.sql:283`). |
| `game_scores` | Sí | INSERT cerrado para anon y authenticated (`08-seguridad-oct.sql:35`). SELECT por columnas (`05-auditoria-oct.sql:20`). |
| `sol_orders` | Sí (`03-web-canje.sql:37`) | Sin políticas: solo service role. |
| `redemptions` | Sí (`redemptions.sql:18`) | Sin políticas: solo service role. |
| `ton_credits` | Sí (`security-hardening.sql:20`) | Sin políticas: solo service role. |
| `skin_purchases`, `stars_purchases`, `ton_stakes`, `withdrawal_requests` | Sí | Se crearon con `SELECT USING(true)` e `INSERT WITH CHECK(true)`. Los INSERT se quitan en `security-hardening.sql:32-35` y los SELECT en `05-auditoria-oct.sql:13-16`. |
| `tournament_awards` | Sí | Lectura pública por columnas (`05-auditoria-oct.sql:24`). |
| `referrals`, `donations`, `players` | **Desconocido** | **No hay CREATE TABLE ni políticas en el repo.** |
| `profiles`, `game_scores` (esquema base) | — | `supabase-schema.sql` tiene 2 líneas: el esquema base no está versionado. |

Para saber el estado real, el dueño puede ejecutar `sql/00-diagnostico.sql` (es de solo lectura) en Supabase.

## 7. Vulnerabilidades y riesgos detectados

| # | Gravedad | Dónde | Qué pasa |
|---|---|---|---|
| V1 | Media | `world.js:2319-2371` | **La posición la decide el cliente.** Dentro del presupuesto (~velocidad×1,2 + dash + 80 px) un cliente modificado puede ir siempre al máximo, colocarse donde los monstruos no llegan o retroceder perfecto entre golpes. No es un teletransporte, pero tampoco es física autoritativa. |
| V2 | Media (disponibilidad y coste) | `world.js:353` (`servidor.accept()`), `worker.js:83` | Un solo DO para todo el mundo (2D + 3D + Chicha Wars) y **sin la Hibernation API**: el DO cobra tiempo de pared mientras haya un socket abierto, y una excepción o un bloqueo del bucle afecta a todos. |
| V3 | ✅ Resuelta en la Fase 1 (17-nov-2026, sin publicar) | `world.js` `simularMapa` / `monstruosDe` | Antes la foto enviaba **todos los monstruos** del mapa a cada jugador, sin filtro por distancia. Gasta ancho de banda y además revela posición y vida de los monstruos fuera de pantalla (wallhack de información). |
| V4 | Baja | `functions/api/lib.js:225` | La comparación del HMAC de `initData` usa `!==` y no es de tiempo constante. |
| V5 | Baja | `world.js:1938`, `worker.js:44` | El secreto interno `x-interno` **reutiliza `TELEGRAM_BOT_TOKEN`** y se compara con `!==`. Hoy `/interno/*` no se puede alcanzar desde fuera, pero si una ruta nueva reenviara la petición original al DO, el token del bot pasaría a ser la llave de admin. |
| V6 | Baja | `world.js:618` | `initData` de Telegram válido durante 24 h: hay ventana de repetición si se filtra un enlace con `#tgWebAppData`. El cliente ya filtra los `initData` ajenos (`client.js:46-50`). |
| V7 | Baja | `world.js:115-122`, `client.js` (token `inv`) | La cuenta de invitado depende de un token en `localStorage`. Un XSS o un dispositivo compartido equivale a robar la cuenta. No se encontró XSS: los `innerHTML` con datos del servidor usan `esc()`. |
| V8 | Media (depende de la BD real) | `skin-purchases.sql:18-22`, `stars-purchases.sql:18-22`, `ton-stakes.sql:22-26`, `withdrawal-requests.sql:22-26` | Crean políticas abiertas (`USING(true)` / `WITH CHECK(true)`). Solo quedan cerradas si **después** se ejecutaron `security-hardening.sql` y `05-auditoria-oct.sql`. Si alguien vuelve a ejecutar un script viejo, se reabren. |
| V9 | Media (desconocido) | `js/donation-manager.js:105`, `js/wallet-manager.js:65`, tabla `referrals` | Escrituras y lecturas con la clave anon sobre tablas sin RLS versionado. (Las donaciones no se tocan: solo se señala.) |
| V10 | Baja | `redeemable-balance.sql:34, 63` | Define `accrue_dq` y `redeem_dq` como `SECURITY DEFINER` **sin `search_path`**. `01-blindaje.sql:173-209` las redefine bien, pero si alguien vuelve a ejecutar el script viejo después, se pisa el arreglo. Mismo patrón que V8: hay scripts antiguos en `sql/` que deshacen el blindaje. |
| V11 | Baja | `wrangler.toml` (`[assets] directory="."`) + `.assetsignore` | Es una lista negra: cada archivo nuevo en la raíz se publica. Hoy quedan visibles páginas de prueba como `prueba_kenney.html` y `prueba_modelo.html`. |
| V12 | Info | `world.js:154-160` | Si el DO se reinicia, se pierden hasta 60 s de progreso (está documentado y es aceptado). |

## 8. Encaje de las fases 1-4 (ver el plan presentado en el chat el 17-nov-2026)

- **Corrección de premisas:**
  - el multijugador va por el WebSocket del DO, no por Supabase Realtime;
  - los personajes viven en el storage del DO, no en tablas de Supabase.
- **La autoridad nueva va en `world.js` y sus módulos** (por ejemplo `functions/mmo/criaturas.js`, mezclado igual que `combate.js`), no en RPC `SECURITY DEFINER`.
  - Una RPC de Postgres no ve el estado en tiempo real del combate (vida del monstruo, posición, amenaza), que vive en la memoria del DO.
  - Solo tendría sentido para un espejo de solo lectura (bestiario público o ranking), escrito por el DO con la service role.
- Antes de cada fase, pasar `node tools/verificar.mjs` (arnés incluido). Para probar en el navegador: `node tools/mmo_local.mjs` y abrir `http://localhost:8787/mmo/` con el sonido en `0`.

## 9. Registro de fases

- **Fase 1 (17-nov-2026), hecha en local y SIN publicar (falta subir el `?v=`):**
  - foto 2D con los monstruos filtrados por distancia (`monstruosDe`, cierra V3);
  - correcciones de posición numeradas, con `corregir()` y `mv.sq`.
  - Ya existían y no se tocaron: el timestep fijo a 60 Hz, la interpolación, el culling y el filtro de jugadores.
  - Pruebas: `pruebasFotoYReconciliacion` en `tools/arnes_mmo.mjs` (arnés: 1529 bien, 0 mal) y `verificar.mjs` en verde. En el navegador, con `mmo_local`, se comprobó que el monstruo entra y sale de la vista y que el snap se reconcilia.
  - Para publicar: `node tools/version.mjs 394` (porque cambió `mmo/js/client.js`), luego `verificar` y el resto del flujo de publicación.
  - Hibernation API (V2): **no se hizo**. Toca todas las sesiones y temporizadores en memoria del DO, así que conviene hacerla como una tarea aparte.
- **Fase 2 (17-nov-2026), hecha en local y SIN publicar: el modelo de criaturas.**
  - **No hay tabla SQL, a propósito.** Las criaturas viven en el personaje (`c.cri`), dentro del almacenamiento del DO, como la bolsa o las mascotas. Supabase no participa: la autoridad es `world.js`.
  - **Formato:** `c.cri = { v, sig, l: [{ i, k, nv, xp, a, t }], eq: [ids] }`.
  - **Modelo y topes:** en `mmo/js/data.js` (`CRIATURA_MAX=24`, `CRIATURA_EQUIPO=3`, `criaturaCapturable`, que deja fuera a los jefes, `nombreCriatura` y `normalizarCriaturas`).
  - **Servidor:** en `functions/mmo/criaturas.js`.
    - `criaturasDe` normaliza una sola vez por objeto (`WeakSet`), así un personaje viejo, una copia restaurada o datos rotos nunca llegan a las reglas.
    - `darCriatura(s, k, nv)` es la entrada que usará la captura de la Fase 3.
    - El mensaje `{ t: 'cri', a: 'ver'|'apodo'|'soltar'|'equipo' }` se despacha en `world.js` (`case 'cri'`). El apodo pasa por `limpiarNombre` y por el filtro de groserías.
  - **Red:** la lista se envía una vez después de `bienvenido` (solo en 2D) y luego en cada cambio. **No** va en `datosPropios`, porque `actualizarYo` se llama en unos 100 sitios.
  - **Cliente:** todavía no muestra nada; la UI llega en la Fase 4. El 3D tampoco recibe nada.
  - **Pruebas:** `pruebasCriaturas` en el arnés (1547 bien, 0 mal) y `verificar` en verde. Con `mmo_local` se comprobó que darCriatura, el apodo y el guardado funcionan.
  - **Para publicar:** subir el `?v=` (cambiaron `data.js` y `client.js`).
- **Fase 3 (17-nov-2026), hecha en local y SIN publicar: captura autoritativa.**
  - **Contexto:** el combate ya era autoritativo (`combate.js`) y no se tocó. La captura es nueva.
  - **Cliente:** solo manda `{ t: 'capturar', id }`. La tecla **C** apunta al objetivo, o al monstruo debilitado más cercano.
  - **Servidor** (`criaturas.js`, `capturar`). Valida:
    - que sea una zona abierta (no el pueblo, ni mazmorras, ni la torre, ni el coliseo);
    - que el monstruo esté vivo y sea capturable (ni jefe, ni especial `o.ex`, ni de mazmorra, ni mundial);
    - que esté a menos de 150 px (230 px en vertical, por los que vuelan);
    - que le quede menos del 35 % de vida;
    - que no pase en más de 3 niveles al jugador;
    - que al menos el 50 % del daño recibido sea del jugador (no se roban capturas);
    - que haya hueco en la colección;
    - que hayan pasado 6 s desde el último intento.
  - **El dado lo tira el servidor:** `probCaptura`, en `data.js`, entre 5 % y 85 %. Todas las reglas están en `CAPTURA`, en `data.js`.
  - **Resultado:**
    - Éxito: el monstruo sale del mapa (`md` con `fuera`) **sin XP ni oro** y entra a `c.cri` con `darCriatura`.
    - Fallo: el monstruo se enfada con el jugador (sube su amenaza).
    - En los dos casos, todo el mapa recibe `{ t: 'capt', id, p, ok }`; el cliente lo muestra con partículas, texto flotante y un tono de Web Audio.
  - **Pruebas:** `pruebasCaptura` en el arnés (1565 bien, 0 mal) y `verificar` en verde. En `mmo_local` se probó la tecla C de verdad: el monstruo pasa a la colección y sale «¡Capturado!».
  - **Pendiente para la Fase 4:** el botón táctil (en el celular aún no se puede capturar), la ventana de la colección y el equipo.
- **Fase 4 (17-nov-2026), hecha en local y SIN publicar: juice, UI de criaturas y audio.**
  - **Ventana «Criaturas»** (`m-cri` en `mmo/index.html`; `abrirCriaturas` y `pintarCriaturas` en `client.js`):
    - se abre con la tecla **U** o con el botón 🐾 de la barra;
    - tiene una sección de equipo (n/3) y otra de colección (n/24), con el retrato pixelado del monstruo (`retratoMon`, en caché como data URL);
    - botones Equipo/Quitar, Apodo (`prompt`) y Soltar (con `confirm`). Cada uno solo manda `{ t: 'cri', ... }`; la lista se actualiza con la respuesta del servidor.
  - **Emojis:** las ventanas pasan por `limpiarEmojis`, que los quita a propósito. Dentro de las ventanas no hay que usar emojis como marca.
  - **Botón táctil de la red** (`t-red`, SVG, junto al chat):
    - solo aparece cuando hay presa: un monstruo debilitado, que no sea jefe ni especial, al alcance, en zona abierta (`hayPresa` / `pintarRed`);
    - queda atenuado durante la espera de 6 s.
    - `pintarRed` se llama cada 100 ms **por tiempo**, no con `frame % N`: con 2 o 3 pasos de física por cuadro (30 o 20 FPS), un múltiplo fijo podía no caer nunca en un cuadro dibujado. Ojo: `frame % 3` del minimapa tiene el mismo riesgo latente (no se tocó).
  - **Juice:** la red vuela del jugador al monstruo (220 ms, sobre una copia fija de su posición, porque el `md` lo borra antes). Al llegar:
    - si entra: destellos dorados, «¡Capturado!», hit-stop de 70 ms, sacudida y vibración;
    - si se escapa: hilos grises y «¡Se escapó!».
  - **Audio:** tres tonos nuevos sintetizados con Web Audio en `TONOS` (`red`, `captura`, `escapa`), sin archivos nuevos. Respetan `dq_mmo_sonido`.
  - **Pruebas:** `verificar` en verde (arnés 1565 bien, 0 mal). En `mmo_local`, en PC y en celular (375×812), se comprobó: la tecla C, la ventana con retratos, el cambio de equipo que persiste al recargar, el botón táctil que aparece, captura y se atenúa, y que se oculta sin presa.
  - **Ojo, para probar:** con el panel del navegador oculto, `requestAnimationFrame` no corre y el HUD no se actualiza. `window.__dq` (solo en `localhost`) ahora expone también `capturar`, `pintarRed` y `abrirCriaturas`.
  - **Para publicar:** `node tools/version.mjs 394` (cambiaron `data.js`, `client.js` e `index.html`), luego `verificar`, commit y push, después `humo_produccion` y la fila en `HISTORIAL-DUENDE.md`.
  - **Quedan fuera:** que el equipo te siga en el mapa (visible para los demás: va en `infoApariencia` / `difundirApariencia`), las criaturas en el 3D y la Hibernation API (V2).
