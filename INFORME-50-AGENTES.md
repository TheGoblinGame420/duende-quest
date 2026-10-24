# Informe de producto: ¿tendrá éxito Duende Quest como juego NFT?

*Síntesis de 50 evaluaciones: 10 áreas × 5 perspectivas (MMO, F2P, web3, jugador casual, QA). No se ha modificado ningún archivo. Un dato lo comprobé yo en el código: en `functions/mmo/world.js:292`, todo mensaje del 3D se desvía a `recibir3d()`, y `hermCrear`, `amigos` y `pase` solo existen en `world.js` (líneas 314, 320 y 327). Las hermandades, los referidos y el cobro del pase en ORIGINS no funcionan. Además, `index.html` contiene 7 apariciones de `APY` o `staking-manager`.*

---

## 1. Veredicto global

**Como juego NFT, hoy no tendrá éxito. Probabilidad honesta: del 5 al 10 %.** Como juego gratis de navegador y Telegram con cosméticos que valen en los dos juegos, tiene una base real. Si se corrige lo de este informe, la probabilidad de consolidar un nicho sostenible sube a un 25-35 %.

**Por qué no funciona como juego NFT:**
- **No existe ningún NFT.** Las skins son entradas en `c.skins` (Durable Object) y en `skin_purchases` (Supabase). Las entrega el dueño a mano y la landing dice «Próximamente NFTs».
- **El token $DUENDE casi no tiene utilidad.** Solo da un 10 % de descuento (`DUENDE_DESCUENTO`).
- **El mTON no tiene fuente propia.** Depende de que el creador meta TON a mano (`FONDO_PCT_INGRESOS = 0`) y de que apruebe cada retiro.
- **Pagar da ventaja.** Las skins de pago suben estadísticas que cuentan en duelos con Elo, en el PvP del Abismo y en el umbral del 10 % de daño que da mTON en los jefes.
- **Los precios se contradicen.** La landing y `lib.js` cobran de US$25 a US$250; el MMO cobra de US$2 a US$20 por las mismas skins.

**Condiciones para tener éxito:**
1. Dejar de venderlo como «juego NFT» hasta que exista propiedad verificable.
2. Que las compras no den poder en PvP ni en mTON.
3. Un solo catálogo de precios y entrega automática.
4. Que ORIGINS (el juego que se destaca) tenga el mismo bucle diario y social que CLASSIC.
5. Cuentas que no se pierdan y que se unan entre dispositivos.

### Nota media por área

| Área | MMO | F2P | Web3 | Casual | QA | **Media** |
|---|---|---|---|---|---|---|
| Contenido gratis | 6,5 | 6 | 5 | 6 | 6,5 | **6,0** |
| Guardado y cuentas | 5 | 5 | 5 | 6 | 5 | **5,2** |
| Diarias, pase y racha | 5,5 | 5,5 | 4 | 5,5 | 5 | **5,1** |
| Jugabilidad CLASSIC (2D) | 5 | 5 | 4 | 5,5 | 5,5 | **5,0** |
| Jugabilidad ORIGINS (3D) | 5,5 | 5,5 | 4 | 5,5 | 4,5 | **5,0** |
| Niveles y progresión | 4,5 | 5,5 | 4 | 6 | 5 | **5,0** |
| Landing y onboarding | 5 | 4,5 | 4 | 5 | 5 | **4,7** |
| Social y comunidad | 5,5 | 4 | 4,5 | 4,5 | 4 | **4,5** |
| Pago y monetización | 4 | 4 | 3 | 4 | 4 | **3,8** |
| NFT / web3 | 3,5 | 3 | 3 | 3,5 | 4 | **3,4** |
| **Media por perspectiva** | **5,0** | **4,8** | **4,05** | **5,15** | **4,85** | **4,77** |

Lectura rápida: lo mejor puntuado es el contenido gratis y lo peor, NFT/web3 y el pago, que son justo lo que se quiere vender. La perspectiva web3 es la más dura (4,05) y la casual la más amable (5,15). El juego convence más a quien no busca cripto.

---

## 2. Fortalezas y riesgos

### Las 5 fortalezas reales

1. **El servidor manda en todo y es difícil hacer trampa.** El Durable Object decide daño, botín y oro. `mover3d()` valida la velocidad (`movBud`) y el vuelo, y no deja atravesar `CASAS`. El combate valida GCD, alcance y recurso. El candado `this.entrando` impide abrir la misma cuenta dos veces (antes duplicaba mTON). Es la base que exige cualquier economía con dinero real.
2. **El contenido gratis es de MMO de verdad.** 4 clases con especializaciones y talentos, una cadena de 40 misiones, 6-7 mazmorras con jefes con guion, la banda de 10, Desafíos +1 a +30 con afijos semanales, la Torre, la Bóveda, expediciones, pesca y profesiones. Nada de esto da mTON y nada tiene muro de pago.
3. **«Un personaje, dos juegos» es cierto en el código.** CLASSIC y ORIGINS comparten `c` (skins, alas, nivel, oro), `dar()` y `sumarXp()`. Una compra de skin vale de verdad en los dos juegos.
4. **El diseño económico y legal es prudente.** Con dinero no se compra mTON. Hay topes diarios y semanales, y para cobrar mTON se pide Nv 15 y 48 h de antigüedad. Los `SWITCHES` apagan el staking, la compra y la venta de TON y el canje, con la justificación legal escrita (Ley 26702 y reglas de Telegram). Hay avisos de «puede bajar a cero» y enlaces a RugCheck y Solscan.
5. **La retención está bien hecha.** Las tareas se eligen por hash de uid+fecha y se cobran solas. La racha retrocede un día en vez de reiniciarse. Los avisos de Telegram llegan a la hora habitual del jugador, con límite contra el spam. Ya se miden cohortes D1/D7/D30.

### Los 5 riesgos mayores

1. **La palabra «NFT» no tiene respaldo, y eso es un riesgo de confianza y regulatorio.** No hay mint, ni metadatos, ni reventa. Venderlo como juego NFT crea una expectativa que el código no cumple, y el público cripto lo detecta enseguida.
2. **Pagar da ventaja, y esa ventaja llega a premios con valor real.**
   - Berserker da +30 % de ataque y Cósmico (US$50) +18 % con robo de vida y aura.
   - `golpeDuelo` usa `s.st.atk` sin neutralizar la skin.
   - Las Alas Solares de pago superan a las mejores que se ganan jugando, en un Abismo donde caer es muerte segura.
   - El paquete `oro20` (140.000 de oro por US$20) compra skins, forja y alas.
   - El mTON de jefe pide el 10 % del daño, y una skin con más ataque llega antes a ese umbral. Esto contradice el propio comentario del código.
3. **Ética y regulación cripto en la landing y el bot.**
   - La sección `#staking` sigue en el HTML con «APY 120 %/240 %», texto FOMO y `staking-manager.js` cargado.
   - La landing anuncia «Tasa fija 1 SOL = 10.000 $DUENDE» directa al creador, lo que parece una venta primaria del emisor.
   - Se promete el canje de DQ a $DUENDE aunque está apagado.
   - Según un evaluador, el bot vende $DUENDE por Stars (`/buy`, `handleBuy`), lo mismo que `wallet.js` apagó por las reglas de Telegram.
4. **Los precios se contradicen y eso destruye la confianza.** En la landing y el arcade, la Legendaria cuesta US$250; en el MMO cuesta US$20 o 100.000 de oro. Además, comprar oro y luego la skin siempre sale más barato que comprar la skin directamente (por ejemplo, Rey a US$7 directa frente a unos US$3,3 vía oro). Quien pagó el precio alto se sentirá estafado.
5. **Todo depende de una persona y de un solo servidor, y ORIGINS está a medias.**
   - Entregas y retiros manuales.
   - Un único Durable Object `mundo-1` (`MAX_JUGADORES = 300`) sin copias de seguridad. Los grupos viven en memoria y se disuelven en cada despliegue.
   - Las identidades `tg:`, `web:` e `inv:` no se pueden unir.
   - En ORIGINS, las hermandades, los referidos y el cobro del pase no llegan al servidor (comprobado). Las diarias no se ven, y las tareas «grupo» y «zona» no avanzan en 3D.

---

## 3. Plan priorizado: las 15 mejoras más valiosas

★ = victoria rápida (alto impacto y esfuerzo bajo). Hay 6. La columna «Piden» indica cuántos de los 50 evaluadores la propusieron, con las propuestas parecidas fusionadas.

| # | Mejora | Impacto | Esfuerzo | Piden | Archivos principales |
|---|---|---|---|---|---|
| 1 ★ | **Que las compras no den poder en PvP ni en mTON.** Añadir a `statsJugador` un parámetro `pvp`/`justo` que ignore `atkMult`, `defMult`, `bonusHp`, `critBonus`, `robo` y el aura de la skin. Usarlo en `golpeDuelo`, en `herir()` cuando el golpe es PvP o duelo, y en el Abismo. Limitar las alas premium a los valores de las Alas de Dragón dentro del Abismo. Calcular el umbral de mTON de jefe sin buffs de skin, o premiar por participación como ya hace el jefe mundial. Mantener `oroMult`/`xpMult` en PvE con tope. | Alto | Bajo-medio | ~26 | `mmo/js/data.js`, `functions/mmo/duelos.js`, `combate.js`, `world.js`, `mundo3d.js` |
| 2 ★ | **Conectar en `recibir3d()` los mensajes sociales del 3D.** Añadir los `case` de `herm*`, `amigos`, `pase`, `lfg*`, `contactoAdd/Quitar`, `banda`, `inspeccionar` y `gesto`, más un test que recorra todos los `t:` que envía `mundo.js`. Es un bug confirmado: las hermandades del commit dec793b no funcionan en el servidor. | Alto | Bajo | 2 (QA y casual) | `functions/mmo/mundo3d.js`, `world.js` |
| 3 ★ | **Un solo catálogo y precios coherentes.** Generar `SKIN_PRICES_USD` (`lib.js`, `helius-verify.js:55`) y las tarjetas de la landing desde `SKINS` y `PAQUETES` de `data.js`. Arreglar el arbitraje oro/USD: o se baja el `usd` de las skins que también se venden por oro, o se calcula a partir de una constante `ORO_POR_USD`. Unificar también el reembolso de `entregarPedido`. Compensar con un cosmético a quien pagó el precio del arcade. | Alto | Bajo-medio | ~16 | `mmo/js/data.js`, `functions/api/lib.js`, `wallet.js`, `index.html` |
| 4 ★ | **Entrega automática de pedidos ya verificados.** Llamar a `entregarPedido({codigo, por:'auto'})` cuando un pago de Stars cuadra (~línea 996) o la transferencia en cadena coincide en el monto exacto (~846-875). La revisión manual queda solo para `por_verificar`. Mostrar el aviso «Activa ya en CLASSIC y ORIGINS». | Alto | Bajo | 10 | `functions/mmo/world.js`, `mmo/js/client.js`, `mundo/js/ventanas.js` |
| 5 ★ | **Diarias visibles y completables en ORIGINS.** En `mundo.js`, añadir `case 'tareas'` y pintar `yo.tareas` en `pintarMisiones()`. En `matar3d`, pasar el tamaño real del grupo en vez de `n=1`. Añadir `mapa` a los monstruos de `crear3d`. Aceptar `expedicion` en `recibir3d`. No repartir `torre10` a quien juega solo en 3D. | Alto | Bajo-medio | ~12 | `mundo/js/mundo.js`, `functions/mmo/mundo3d.js`, `tareas.js` |
| 6 ★ | **Limpiar de la landing lo que no existe o expone legalmente.** Borrar `#staking` y `staking-manager.js` del HTML, no solo ocultarlos. Quitar «Próximamente NFTs», el canje DQ a $DUENDE, «Stars o TON», «Necesitas $DUENDE para comprar objetos NFT» y la tasa fija SOL→$DUENDE. Llevar los botones de la tienda a `/mmo/` o `/mundo/`, no a `game.html`. Corregir las cifras (5, 6 o 7 mazmorras; «tres formas de jugar»). | Alto | Bajo | ~10 | `index.html`, `js/staking-manager.js` |
| 7 | **Cuenta y protección del invitado, también en ORIGINS.** Login propio en `#v-inicio`, renombrado a «$DUENDE ORIGINS». Aviso de «guarda tu duende» en Nv 3, en la primera compra y al pasar del 2D al 3D. Código de rescate con el token `dq_mmo_tok`. Herencia vía `user_metadata.inv`, para que funcione aunque el correo se confirme en otro navegador. Preguntar qué hacer con el invitado cuando la cuenta ya tiene personaje. Bloquear compras a invitados. | Alto | Medio | ~14 | `mundo/index.html`, `mundo/js/mundo.js`, `mmo/js/client.js`, `world.js` |
| 8 | **Vincular Telegram y correo en una sola identidad.** Código de un solo uso, alias `alias:web:<id>` → `tg:<id>` resuelto en `holaCuenta()`, y `skinsPagadas()` consultada para todas las identidades. Más adelante, inicio de sesión con firma de wallet (signMessage + ed25519) como alias, no como cuenta nueva. | Alto | Medio | 7 | `functions/mmo/world.js`, `lib.js`, `helius-verify.js`, clientes |
| 9 | **Copias de seguridad y guardado más fiable.** Copia diaria de `c:*` a R2 o Supabase y restauración desde Modo Dios. Versión de esquema `c.v`. Si el `put` falla, volver a marcar `s.sucio=true`. Guardar en el acto tras un drop épico, una mazmorra o una compra. Persistir grupos, LFG, `dueloPares` y `pvpPares` para que sobrevivan a los despliegues. | Alto | Medio | ~10 | `functions/mmo/world.js`, `social.js`, `cron.js` |
| 10 | **Un pase que valga todo el mes.** Una pista premium solo cosmética (US$3-5) válida en CLASSIC y ORIGINS. Un premio exclusivo distinto cada mes (hoy `duende_pase` se repite). Tope diario de puntos por mazmorra. Puntos dobles para ponerse al día a quien entra a mitad de mes. Cobro automático de los niveles pendientes al cambiar de mes, porque hoy se pierden. | Alto | Medio | ~14 | `mmo/js/data.js`, `functions/mmo/pase.js`, `mazmorras.js`, clientes |
| 11 | **Diarias sin bloqueos.** Un cambio de tarea gratis al día. Quitar «grupo» y «mundial» cuando hay poca gente conectada. Unificar la «Caza del día» con `TAREAS_DIA`, que hoy son dos contadores de caza que se confunden. Enlazar invasiones y cofres con tareas y puntos del pase. | Medio-alto | Bajo | ~11 | `functions/mmo/tareas.js`, `eventos.js`, `data.js` |
| 12 | **Progresión después del nivel 60 y talentos con elección.** Una Maestría que acumule la XP que hoy se tira. Mover `sumarXpSemana` antes del `return` de `NIVEL_MAX`. Convertir la XP de las tareas en oro o fichas en el nivel 60. Bajar los puntos de talento (hoy 51 puntos para 50 rangos: todos acaban iguales) o crear ramas excluyentes. | Alto | Medio | ~13 | `functions/mmo/world.js`, `mmo/js/data.js` |
| 13 | **Facciones equilibradas y estatus por temporada.** Bono de PA y oro para la facción con menos gente. Quitar el +1/+2 de PA del dueño del Núcleo. Escalar la puerta y los jefes según los participantes reales. Premios cosméticos de temporada para el top de hermandades, Elo y PA, y premios por cada rango del Abismo. Que la Fortaleza la ocupe una hermandad. | Alto | Medio | ~17 | `functions/mmo/mundo3d.js`, `abismo3d.js`, `hermandades.js`, `world.js` |
| 14 | **Contenido propio de ORIGINS.** Misiones variadas (ir, recoger, pescar, volar, Cueva) en lugar de 40 veces «mata N». Entregar misiones a distancia o una Piedra de Hogar. Monstruos agresivos según nivel y élites raros. Invasiones y cofres también en 3D. Reconexión robusta al volver de segundo plano en Telegram. | Alto | Medio | ~12 | `mmo/js/mundo3d.js`, `functions/mmo/mundo3d.js`, `eventos.js`, `mundo/js/mundo.js` |
| 15 | **mTON honesto y transparente.** Endpoint público con `transparencia()` e `infoFondo()`. Mostrar «hoy no hay fondo» y los días estimados hasta el retiro. Exigir `ton_proof` al fijar la wallet (hoy se puede bloquear la wallet de otra persona). Poner una actividad mínima para cobrar mTON (contra bots de auto-ataque). Llamarlo «recompensa de evento financiada por el creador». | Medio | Bajo-medio | ~8 | `functions/mmo/world.js`, `cron.js`, `mmo/js/client.js`, `index.html` |

**Fuera del top, pero baratas:** ignorar y reportar jugadores, con un filtro antiestafa que bloquee direcciones base58, «seed» y enlaces en el chat general (2 evaluadores). Un paquete de bienvenida de US$0,99-1,99 que se compre una sola vez (3). La etiqueta «Solo en ORIGINS» en las alas y el bug de pagar dos veces unas alas (`world.js` 758-759) (2).

**Nota sobre Telegram:** pediste dejar Telegram como está. Las mejoras 4 (webhook de `successful_payment`) y 3 (precios de `telegram/index.html`) tocan esa parte. El `/buy` de $DUENDE por Stars en el bot es un riesgo frente a las reglas de Telegram. Lo dejo señalado para que decidas tú, sin tocarlo.

---

## 4. Recomendaciones específicas

### Contenido gratis frente a contenido de pago
- **Sí:** que lo gratis sea el juego completo (ya casi lo es) y que lo de pago sea estética y comodidad: skins, tintes, alas, mascotas, marcos de nombre y la pista premium del pase. Mensaje para la tienda: *«Una compra, dos juegos. En PvP todos pelean igual»*.
- **Sí:** que pagar directamente nunca salga peor que comprar oro, y poner en cada tarjeta «Vale en CLASSIC y ORIGINS». En las alas, «Se usan en ORIGINS».
- **No:** vender multiplicadores de ataque que cuenten en duelos, en el Abismo o en el umbral de mTON. Tampoco vender oro que se pueda gastar sin límite en forja y runas.
- **No:** dejar las mejores alas solo para quien paga en una zona donde volar decide si vives o mueres.

### Misiones diarias
- Un solo panel «Hoy», igual en 2D y 3D, que junte la Caza del día, las 3 diarias, las 2 semanales, los cofres de la cueva, los asedios restantes y el pase.
- Un cambio de tarea al día, y ninguna tarea imposible de cumplir para quien juega solo 20 minutos.
- Que los eventos (invasiones, élites, cofres) sumen tareas y puntos del pase, y que existan en ORIGINS.
- Racha con hitos a 14, 30 y 60 días con cosméticos. Corregir el reinicio a 1 al faltar un día con la racha en 7 y los textos que dicen «vuelve a empezar».

### Guardado del progreso
- Prioridad absoluta en un juego que vende cosas «para siempre»: **copias de seguridad diarias y restauración**. Hoy un bug podría borrar compras pagadas sin vuelta atrás.
- Que el invitado no pueda perder su personaje sin saberlo: aviso temprano, código de rescate y herencia a prueba de navegadores.
- Que una persona tenga un solo personaje en todas sus identidades (Telegram, correo y, más adelante, wallet).
- No mandar a modo invitado en silencio cuando falla la verificación de la sesión. Hay que reintentar o preguntar.

### Niveles y progresión
- La curva 1-60 está bien, pero se acaba en pocas decenas de horas. Hay que dar un destino a la XP del nivel 60 (Maestría) y que esos jugadores sigan contando en el ranking semanal.
- Talentos con decisiones reales. Hoy en el nivel 60 todos tienen todo.
- La banda debe volver a dar el mejor equipo: hoy un Desafío +7 la iguala.
- Los rangos del Abismo deben dar premios cosméticos y tener temporadas, con tope diario de PA en PvE.
- La forja +10 cuesta menos que una misión tardía de jefe. Hay que alargarla o pedir materiales.

### Landing page
- **Embudo corto:** hero con las dos cartas, tráiler, capturas, «empieza en 3 pasos», la tienda real (generada desde `data.js`), la tabla gratis/pago y la FAQ. El token, la tokenomics, las donaciones y el arcade van a una página aparte, `/token`.
- **El vídeo:** `promo3d.mp4` sí trae audio AAC y el hero tiene el botón `#hero-son`. Pero en `/inicio/` el vídeo siempre está mudo y sin botón, y el formato vertical se recorta en una caja 16:12. Hay que añadir el botón de sonido y corregir la proporción. La carta CLASSIC debería tener vídeo y no solo una imagen fija.
- **Recomendar según el dispositivo:** en móviles sin WebGL2 o con poca memoria, recomendar CLASSIC y arrancar ORIGINS en calidad baja. Respetar `saveData`, sin autoplay en planes prepago.
- **«Continuar con <nombre>»:** que lleve al último juego usado, para no volver a preguntar cuál elegir.
- **Horarios del jefe mundial:** el contador de `/inicio/` usa :00 y :30 (2D) bajo la carta de ORIGINS, cuyo jefe sale a :15 y :45. Hay que mostrar los dos.

### Uso de NFT: qué SÍ y qué NO hacer

**SÍ:**
- Decir la verdad hoy: «Tu skin queda ligada a tu cuenta y vale en $DUENDE CLASSIC y $DUENDE ORIGINS».
- Primer paso barato: un **recibo de propiedad** por cada entrega (pedido, firma de Solscan o cargo de Stars, fecha), visible en los dos juegos y guardado en Supabase.
- Si hay demanda: un **cNFT opcional** como certificado de las skins premium, leído con `getNFTs()` en `skinsPagadas()`, y certificados *soulbound* de logros gratis (pase 20, Rey de la Torre, Desafío +20).
- Dar utilidad al token sin venderlo: un cosmético o título por demostrar con firma que se tiene X $DUENDE, además del descuento.

**NO:**
- Llamarlo «juego NFT» ni «play-to-earn» mientras no haya activos en cadena ni un fondo sostenible.
- Prometer reventa, valor futuro, APY ni rendimientos. Hay que borrar del HTML el staking oculto.
- Vender $DUENDE directamente desde el emisor (la tasa fija SOL→$DUENDE, `/buy`), ni financiar el mTON con lo que pagan los nuevos jugadores.
- Convertir en NFT objetos que dan ventaja de combate. Solo deben ser NFT los cosméticos, que no rompen el equilibrio.

**Archivos clave citados:** `C:\Users\Alonso\OneDrive\Desktop\herramientas de trabajo POCHI\PRIVADO NO TOCAR\launchduende2,0\functions\mmo\world.js` (enrutado al 3D en la línea 292; los casos `pase`, `amigos` y `hermCrear` solo existen aquí, líneas 314, 320 y 327), `...\functions\mmo\mundo3d.js` (a `recibir3d()` le faltan esos casos), `...\mmo\js\data.js`, `...\functions\api\lib.js`, `...\index.html`.