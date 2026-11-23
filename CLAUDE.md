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
- **v395 (17-nov-2026), publicada: cuenta rápida con correo.**
  - `js/cuenta.js` (`formCuenta` / `abrirCuenta`): solo correo + contraseña; el usuario sale del correo. La usan CLASSIC (`pintarCuenta`), ORIGINS (`cuentaAqui`: pantalla de carga, avisos y tienda) y Chicha Wars (`data-dq-cuenta`).
  - Un solo cliente Supabase por página: `window.__dqSb`. En Telegram, ORIGINS sigue con el camino viejo por `/mmo/#cuenta`.
  - Pendiente del dueño: `/mundo/` en las Redirect URLs de Supabase y probar a crear una cuenta real.
- **v396 (17-nov-2026): mundo vivo en el 2D, por los comentarios de los jugadores** («el mundo se ve vacío», «falta contenido, NPC y gráficos», «el ranking no refleja el 2D y el 3D»). Mismo método por fases.
  - **Fase 0 (auditoría):** las 10 zonas abiertas del 2D tenían 0 NPC, 4-5 plataformas a una sola altura y nada que se moviera aparte de los monstruos. El ranking de niveles ya era uno solo (mismo personaje `c:<uid>`), pero no se notaba: el 3D abría en «Semana» y ninguna fila decía dónde juega cada uno.
  - **Fase 1 (ranking único):** `c.modos` (bits: 1 = 2D, 2 = 3D) se apunta al entrar (`world.js`, junto a `entrar3d`/`entrarMapa`) y va como 5.º campo de la fila de `ranktodos.js`. `rkFila` añade `m` (dónde juega) y `on` (en línea ahora, por `porUid`). Los dos clientes lo pintan con `marcaModo` y la nota `NOTA_RANK_UNICO`; el 3D abre en la pestaña «Nivel».
  - **Fase 2 (vecinos):** `mmo/js/vecinos2d.js` (datos compartidos) y `functions/mmo/vecinos2d.js` (autoridad). Hay 2 vecinos por zona, con cadenas de 3 encargos (caza de un monstruo de la zona, caza libre o el jefe).
    - Flujo: hablar acepta → cazar en SU zona abierta avanza (`progresoVecinos`, desde `progresoTarea`) → volver a hablar cobra.
    - El servidor valida la cercanía (`VECINO_DIST` + 60), el nivel y que no se cobre dos veces. El premio está en `premioVecino`.
    - Progreso: `c.v2 = { idEncargo: numero | true }`. Mensaje: `{ t: 'v2', a: 'hablar', id }`. Respuestas: `v2` y `v2fin`.
    - Cliente: `dibujarVecinos` (con ❗, ❔ o ⭐ encima), su campamento (`campamentoVecino`: toldo, petate y fogata, para no confundirlo con un monstruo), la ventana `m-vec` y los puntos en el minimapa.
  - **Fase 3 (gráficos):**
    - Cornisas: un piso alto por zona (`CORNISAS` al final de `data.js`: ~78 px sobre cada plataforma media). Se llega con doble salto. Las ven igual el cliente y el servidor (`sueloEn`, `techoEn`).
    - Vida del ambiente en `fondo2d.js` (`VIDA`, `vidaCielo`, `vidaSuelo`, `vidaAire`): aves, murciélagos, cóndores, peces al fondo, luciérnagas, mariposas, hojas, brasas, burbujas, esporas, nieve, polvo y animalitos de suelo.
    - No tiene estado y se calcula en función del tiempo. Con el modo ligero hay menos.
  - **Fase 4 (retención):** la primera criatura del equipo te sigue por el mapa y los demás la ven con su apodo.
    - Servidor: `cc = [tipo, apodo]` en `infoApariencia`, `companeroDe` y `refrescarCompanero` en `criaturas.js`.
    - Cliente: `dibujarCompanero`.
  - **Pruebas:** arnés con `pruebasRankUnico`, `pruebasVecinos2d` y `pruebasCompanero` (1583 bien, 0 mal). En Chrome sin ventana, con `mmo_local`, se probó todo el ciclo de los vecinos y se sacaron fotos de 8 zonas (vertical y horizontal).
  - **Siguiente:**
    - pedido diario repetible de los vecinos;
    - objetos rompibles (vasijas) en las zonas;
    - más tipos de terreno (agua, escaleras);
    - criaturas en el 3D;
    - Hibernation API (V2).
- **v397 (17-nov-2026): ranking fuera del juego y más juegos en la portada** (el dueño: «en Telegram /ranking no sale nada», «en la web no sale ningún ranking», «no hay opción para ver más juegos»).
  - Causa: `/ranking` del bot y el ranking de la portada leían solo `game_scores` del arcade, que está vacío. El ranking real es el del MMO (`ranktodos.js`).
  - `rkTop(n)` y `rankPublico()` en `ranktodos.js`. Ruta pública `GET /mmo/rank` (`world.js` `_fetch`; `worker.js` la cachea 30 s en `caches.default`; añadida a `run_worker_first`; también en `mmo_local`). Devuelve `{ tot, on, nv: top 20 niveles con m/on, sem: top 10 XP de la semana }`. Nada privado: lo mismo que ya se ve dentro.
  - `/interno/tops` añade `nv` (top 10) y `tot`. `handleRanking` del bot muestra el top 10 de niveles 2D+3D (con 🟢 si está en línea), y debajo el top 3 del arcade solo si hay partidas.
  - Portada: pestañas Niveles 2D+3D / Esta semana / Arcade (se pide al acercarse a la sección); fila «Más juegos del duende» con Chicha Wars y Arcade; el menú dice «Juegos» (#juegos).
- **v398 (21-nov-2026): cuenta unificada y recordatorio a invitados** (el dueño: «que se registren desde donde están, no que los mande a Telegram o al 2D»).
  - ORIGINS: `cuentaAqui` abre siempre `abrirCuenta` de `js/cuenta.js`, también dentro de Telegram (se quitó `irACrearCuentaClassic`); `iniciarSesion` de la tienda ya no es `null` en Telegram. Si Telegram no verifica al jugador, el `hola` cae a la sesión web (igual que antes).
  - Arcade (`game.html`): `showAuthModal` de `js/auth-manager.js` usa `window.__dqAbrirCuenta` (módulo en `game.html`); el formulario viejo solo queda si el módulo no carga.
  - `recordarInvitado(op)` en `js/cuenta.js`: franja arriba con «Crear cuenta» / «Luego». Primera a los 3 min, luego cada 10 min, máx. 4 por visita; también al subir a `RECORDAR_NV`. Se salta con ventanas abiertas, en combate o muerto. CLASSIC y ORIGINS la crean una vez (`recInv`).
  - Modo Dios: no hay código secreto, a propósito. Dueño = `ADMIN_TG_ID` y las cuentas vinculadas a ese duende (`c.vinc`); moderador = uids `web:<uuid>` o `tg:<id>` en el secreto `MMO_ADMINS`.
- **v399 (21-nov-2026): una sola cuenta en Telegram y Chrome, y Modo Dios en el 3D** (el dueño: «entro desde Telegram y en Chrome es como una cuenta nueva», «no tengo cómo activar el modo dios»).
  - **Causa:** fuera de Telegram no hay `initData`, así que el navegador entraba como invitado. Además ORIGINS (lo que abre el bot) no tenía panel de dios: solo CLASSIC (F2).
  - **Llave** (`functions/mmo/llave.js` + `js/llave.js`):
    - En Telegram, `{ t: 'llave' }` (solo con `s.authK === 'tg'`) da un código de 32 hex de un uso, válido 15 min y guardado solo en memoria.
    - El navegador abre `/mundo/#llave=...`, el `hola` lleva `{ k: 'llave', cod }` y recibe `llaveOk { tok }`, que se guarda en `localStorage dq_dt`.
    - Después el `hola` lleva `{ k: 'dt', tok }`.
    - En el storage solo va `dt:<sha256>` → `{ uid, t }` y `dtl:<uid>` (máx. 5). Caduca a los 120 días sin uso. `llaveCerrar` borra todos y expulsa esas sesiones.
    - **Riesgo:** el mismo que el token de invitado (V7).
  - **Modo Dios en ORIGINS** (`mundo/js/dios3.js`): F2 o Ajustes → «Modo Dios». Tiene poderes, jefe mundial, anuncio, jugadores, pedidos y moderación, y usa los mismos mensajes `dios`. Al entrar sale un aviso si eres dios.
  - **Pruebas:** `pruebasLlave` en el arnés.
- **v401 (22-nov-2026): todo en duendequest.com.**
  - TON Connect (manifiesto y `manifestUrl`) pasó al dominio oficial.
  - Las PÁGINAS de workers.dev se mudan solas: `functions/api/mudanza.js` responde 301 a robots, HEAD y a quien ya pasó sin nada guardado (cookie `dqm=0`); a un navegador le da una página puente que lee su `localStorage` (`dq_*`, `dq3_*`, `cw_*`, sesión `sb-*`) y salta a `/mudanza#paquete`. `mudanza.html` lo guarda sin pisar nada, solo si la visita viene del dominio viejo, y sigue a la misma ruta con sus parámetros y #hash.
  - No se redirigen `/api/*`, `/mmo/ws` ni los archivos de workers.dev (webhooks y clientes abiertos).
  - `run_worker_first` (wrangler.toml) ahora lista también las páginas: **una página nueva hay que añadirla allí** en todas sus formas. Lo comprueba `tools/arnes_mudanza.mjs` (dentro de `verificar`); de punta a punta en producción: `node tools/qa_mudanza.mjs`.
- **v402 (22-nov-2026): paleta global «Esmeralda y oro místico».**
  - Fuente única: `css/tema.css` (`--primary`, `--secondary`, `--accent`, `--bg-dark`, superficies, texto, estados, degradados y brillos). No se enlaza: `node tools/tema.mjs` lo copia en cada página (`<style id="dq-tema">`) junto con el «puente» de los nombres viejos de esa página (`--bg`, `--panel`, `--pri`, `--oro`…). `verificar` falla si una copia quedó vieja.
  - Jerarquía: esmeralda = acción principal; oro = token, premios y premium; violeta = ORIGINS y rarezas. El maná, la XP de descanso y la rareza «Rara» siguen azules; el lienzo del juego y los colores de daño/clase no se tocaron; `/chicha/` y Chicha Wars conservan su morado.
  - Para comparar un cambio de colores: `node tools/fotos_paleta.mjs <carpeta>` con `mmo_local` en marcha.
- **v403 (22-nov-2026): identidad unificada, mascotas místicas e inventario vivo.**
  - **Handoff por HTTP** (`functions/api/auth.js` + `functions/mmo/llave.js`): `POST /api/auth/telegram-handoff` (initData) → OTT de un uso, 60 s, solo en memoria; `/?ott=` → `/api/auth/canje` → cookie `dq_s` (HttpOnly; Secure; SameSite=Lax). `_fetch` lee la cookie en la subida del WebSocket (solo con Origin nuestro) y el hola dice `{ k: 'ck' }`. Si el navegador ya tenía otra cuenta: 409 y el cliente pregunta. `/api/auth/salir` borra el token (`dtCerrar`) y manda `Clear-Site-Data`. Esto mejora V7 para la cuenta de Telegram en el navegador (el token ya no está en `localStorage`).
  - **Unir cuentas sin código**: `{ t: 'vincProbar', tok | d }` (`vincular.js`); nunca archiva un duende con progreso (Nv > 5 o compras).
  - **Rol admin**: `ADMIN_TELEGRAM_IDS` y `ADMIN_EMAILS` dan `'mod'`; el correo solo con `emailOk` y `CORREO_CONFIRMADO=1`. Dueño sigue siendo `ADMIN_TG_ID`.
  - **Mascotas místicas**: `functions/mmo/pets-config.js` (números, solo servidor), `functions/mmo/mascotas.js` (huevo: `c.huevo`, `c.huevoDado`, `c.eclos`), `js/mascotas-ui.js` (ventana, tecla N). Van sobre `MASCOTAS` / `c.mascota`. `datosPropios` manda `huevo`, `mv` y `bmax`.
  - **Inventario vivo**: `js/vivo.js`. **Instalar**: `js/instalar.js`. **Pruebas**: `pruebasHandoff` y `pruebasMascotasMisticas` en el arnés; `tools/qa_handoff.mjs` (Chrome real contra `mmo_local`).
  - **No hecho**: memecoin en TON, correos propios, avatar subido, insignia de creador (ver `SIGUIENTE.md`).
- **v404 (22-nov-2026): gastos en $DUENDE y registro de quema.**
  - Excepción aprobada por el dueño a «los pagos son manuales»: los tres `GASTOS_DUENDE` (eclosión instantánea, nivel de mascota, protector de racha) se **entregan solos** tras la verificación en la cadena. Skins, oro y lo demás siguen igual. La verificación de pagos no se tocó.
  - `functions/mmo/gastos.js`: `gastoDisponible`, `gastoAplicar`, `gastoEntregar`, `verificarQuema`, mensaje `{ t: 'gastos' }`. Niveles en `c.petNv` (bono ×(1 + 0,10·nivel), `pets-config.js`); protectores comprados en `c.login.amuC`.
  - Los gastos no cuentan como ingreso del fondo de mTON (van a quema) ni marcan `c.compro`.
- **v405 (22-nov-2026): la primera mascota, regalada a los duendes que ya existían.**
  - `regaloMascota(c)` (tras `huevoAlEntrar`, en el hola): con cuenta, creado antes de `REGALO_PET.hasta` (`pets-config.js`) y sin ninguna mística → `huevoNacer` y queda puesta. Una vez (`c.petRegalo`). Los duendes nuevos siguen incubando su huevo.
  - `regaloAvisar`: guarda al momento; el aviso (toast con `imp`) y el destello salen a los `REGALO_PET.espera` ms. El arnés pone `hasta = 0` y `espera = 0`.
  - `js/instalar.js` pone `body.dq-franja-inst` mientras la franja está a la vista (el 2D baja sus avisos).
- **Dominio (22-nov-2026): una sola dirección y zona endurecida.**
  - `tocaMudanza` también muda `www.` y `http://` (son otros orígenes); `mudanza.html` acepta esas procedencias. `HSTS` y `HOST_WWW` en `functions/api/dominio.js` (`_headers` lleva la misma cabecera a mano; el arnés de mudanza lo comprueba).
  - `worker.js` responde `/.well-known/security.txt` y `/favicon.ico` (están en `run_worker_first`). `[observability]` activo: registros en el panel.
  - En el panel: TLS mínimo 1.2, DNSSEC, DMARC en reject y Email Routing (`contacto@duendequest.com` reenviado al Gmail del dueño; el dominio recibe pero no envía correo). «Always Use HTTPS» sigue apagado a propósito hasta el 23-dic-2026 (ver `SIGUIENTE.md`).
  - Las herramientas con Chrome sin ventana se identifican como «Headless» y el servidor las trata como robot (301 sin puente): para probar la mudanza hay que poner un User-Agent normal.
