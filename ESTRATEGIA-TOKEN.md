# $DUENDE — De memecoin a token con futuro: el diagnóstico real

**Fecha:** 2 de agosto de 2026
**Verificado directamente contra:** RPC de Solana mainnet, API de pump.fun, DexScreener, CoinGecko, normativa peruana vigente y las Blockchain Guidelines de Telegram.

> No soy abogado ni asesor financiero. Las secciones legales describen normas concretas con su número y fecha para que las lleves a un profesional; no sustituyen una opinión legal. Las cifras económicas son aritmética verificable, no una recomendación de gasto.

---

## 1. El estado real de tu token, con números

Fui a la cadena a mirar, no a la API de marketing. Esto es lo que hay:

| Dato | Valor verificado (2 ago 2026) |
|---|---|
| Estándar | **Token-2022**, no SPL clásico |
| Mint / freeze / update authority | **Las tres revocadas** ✅ |
| Supply on-chain | 983.707.107 (se quemó un 1,63%) |
| Market cap | **$1.467** |
| Progreso de la curva de bonding | **19,35%** |
| SOL real acumulado en toda su vida | **2,38 SOL ≈ $175** |
| Holders reales | **3** (uno eres tú con el 12,83%; otro tiene 0,89%; el tercero, polvo) |
| Wallets que compraron y vendieron todo | 5 |
| Pares en DexScreener | **0** |
| Último trade | **11 de junio de 2026 — 52 días sin una sola operación** |

Lo importante de esta tabla no es que los números sean bajos. Es lo que significan juntos: **tu token no está barato, está inactivo.** En toda su vida ha entrado $175 de dinero real. Ocho personas lo tocaron, cinco se fueron. Llevas casi dos meses sin un solo intercambio.

Hay una buena noticia escondida ahí: como solo hay 3 holders reales, **no estás atrapado**. Cualquier decisión que tomes sobre este token, incluida abandonarlo, cuesta prácticamente cero en compensar a los tenedores actuales. Eso es libertad, no fracaso.

Y una advertencia técnica que probablemente nadie te dijo: el token es **Token-2022**, no SPL clásico. Es limpio (solo tiene extensiones de metadatos, sin transfer fee ni hooks), pero **añade fricción real** en algunos exchanges y AMMs que todavía no lo soportan del todo. Si algún día persigues un listado, ese detalle te va a aparecer.

---

## 2. Tu premisa legal es incorrecta, y es lo más caro del proyecto

Dijiste: *"no cobro dinero real, cobro criptomonedas para comprar $DUENDE"*.

Entiendo la lógica, pero en Perú es exactamente al revés de como lo piensas. El **Decreto Supremo 006-2023-JUS** define como Proveedor de Servicios de Activos Virtuales (PSAV) a *cualquier persona natural o jurídica* que realice, entre otras, esta actividad:

> *"intercambio entre una o más formas de activos virtuales"*

Es decir: **cripto por cripto está cubierto de forma explícita.** Cobrar en cripto en vez de en soles no te saca del reglamento — es literalmente el supuesto que el reglamento describe. Y "persona natural" está en el texto, así que ser un dev solo tampoco exime.

De las cinco actividades que definen a un PSAV, tu modelo actual dispara al menos cuatro:

| Actividad PSAV | Cómo la disparas |
|---|---|
| Intercambio activo virtual ↔ fiat | Telegram Stars (se compran con tarjeta: eso **sí** es dinero real) |
| Intercambio entre activos virtuales | Recibes TON/SOL, entregas $DUENDE |
| Transferencia de activos virtuales | Envías los tokens a mano |
| Custodia y administración | El "staking": tú guardas fondos de terceros |
| Venta de un activo virtual por su emisor | Eres el emisor vendiendo tu propio token |

Ser sujeto obligado ante la UIF implica: registro, SPLAFT, oficial de cumplimiento, KYC, registro de operaciones y reporte de operaciones sospechosas **sin umbral mínimo** ("sin importar los montos involucrados"). Y desde el **1 de agosto de 2026 — anteayer** — también la Travel Rule del Capítulo VIII de la Resolución SBS 02648-2024.

**Ahora la parte tranquilizadora:** con 2 usuarios y $1.467 de capitalización, la probabilidad de que alguien te fiscalice hoy es prácticamente nula. Ningún regulador abre un caso por $1.467. El problema no es hoy: es que **la exposición nace el día uno y se activa cuando lances de verdad**.

Y la conclusión aritmética es importante: cumplir formalmente con todo esto cuesta un estimado de **S/ 15.000–40.000 el primer año**. Tu token vale $1.467 en total. **Cumplir cuesta entre 4 y 10 veces el valor completo del proyecto.** Por eso la recomendación sensata no es "regularízate": es **rediseñar el modelo para no disparar estas normas**.

---

## 3. Lo único que yo apagaría hoy mismo: el "staking"

De todo lo que hay en el proyecto, el "staking" es la única pieza con **exposición penal**, no administrativa.

- El **art. 11 de la Ley 26702** prohíbe a toda persona, natural o jurídica, captar o recibir dinero de terceros en depósito o cualquier modalidad similar sin autorización previa de la SBS.
- El **art. 246 del Código Penal** castiga esa conducta con **3 a 6 años de prisión** más multa. Es un delito de peligro abstracto y de habitualidad: **no hace falta que nadie pierda dinero ni que haya denuncia**.
- Precedente real y cercano: la SBS clausuró a **Lima Capital Group** por captar dinero prometiendo rentabilidad del 15–32% anual. Tu "staking" ofrece hasta **240% de APY** — es el mismo esquema, con un número más llamativo.

Existe un matiz honesto: el art. 11 dice literalmente "dinero", y no hay jurisprudencia peruana publicada que confirme que las criptomonedas cuentan como tal. Un abogado defensor tendría ahí un argumento real. **Pero eso es un argumento no probado sobre el que no se construye un negocio**, y no te protege de la vía administrativa ni de la Ley 30050 sobre oferta de activos financieros.

Y hay algo que va más allá de lo legal: **el código actual no puede cumplir lo que promete.** Acredita la recompensa al instante en vez de al vencimiento, y **ningún proceso devuelve nunca el principal en `unlock_at`**. Tú dices que lo devuelves a mano, y te creo — pero el día que estés de viaje, enfermo o simplemente sin fondos, desde fuera se ve exactamente igual que un rug pull. Tu propia descripción pública dice *"dev doxxed on cam"*. Has puesto tu cara como garantía de una promesa que el sistema no puede sostener solo.

**Lo que ya hice:** dejé el `ton_stake` **apagado por defecto** con un interruptor de emergencia en `functions/api/wallet.js`. Devuelve 503 sin tocar nada más. Para reactivarlo hay que cambiar una constante — es reversible en 10 segundos, pero quería que la decisión de reactivarlo fuera consciente y no un descuido.

**La alternativa que conserva el gancho sin el riesgo:** un pase de temporada o bonus de racha. El jugador **nunca te transfiere la custodia de nada**; acumula multiplicadores por jugar días seguidos. Mismo efecto psicológico, cero pasivo financiero, cero superficie regulatoria.

---

## 4. Telegram puede borrarte la Mini App mañana

Esto no estaba en mi radar y apareció en la investigación. Las **Blockchain Guidelines de Telegram** para Mini Apps exigen que una Mini App:

> use exclusivamente la blockchain TON para la creación y distribución de tokens

Y prohíben expresamente **emitir o distribuir activos cripto de otras blockchains**, **promocionar tokens de otras cadenas** en el canal de la Mini App, y **recompensar a usuarios por conectar wallets de otras cadenas**.

Tu Mini App reparte un token de **Solana**. Es incumplimiento directo de las tres cosas.

Es el único riesgo de toda esta lista que puede eliminar tu producto **de un día para otro y sin aviso**, porque toda tu distribución vive en Telegram.

**La separación que lo resuelve:** dentro de la Mini App solo existen **DQ** (puntos internos, no transferibles, sin precio, sin promesa de conversión) y **Telegram Stars** como método de pago. El canje a `$DUENDE`, si lo mantienes, vive **exclusivamente en la web**, sin enlace ni mención desde la Mini App ni desde el canal de Telegram.

Son 2–4 horas de trabajo. Ignorarlo cuesta el 100% de tu canal de distribución.

---

## 5. "Estar listada como criptomoneda" no es una cosa que exista

No hay registro oficial ni certificación de "ser criptomoneda". Lo que hay es una escalera de visibilidad con cuatro peldaños:

| Peldaño | Requisito real | Coste |
|---|---|---|
| **DexScreener / GeckoTerminal** | Tener un pool de liquidez con al menos 1 transacción | Gratis, automático |
| **CoinGecko** | Un mercado real con volumen orgánico | Gratis, se solicita |
| **CoinMarketCap** | ~$50.000/día de volumen, $400.000–500.000 de liquidez | Gratis en tasas, imposible en umbrales |
| **CEX tier 2** (MEXC, BingX) | Expediente + market making | **$50.000–80.000** |
| **CEX tier 1** (Bybit, Bitget) | Opinión legal + doble auditoría | **$100.000–320.000** |
| **Binance** | — | **$1M–5M+** en coste real total |

Tu market cap **completo** es $1.467. El listado más barato de la tabla cuesta **34 veces todo tu token**. Y en 2026 los tier-1 exigen además opinión legal formal de clasificación y dos auditorías de contrato.

Hay algo peor que el precio: **hoy no cumples el requisito de entrada ni del primer peldaño**, porque DexScreener solo indexa tokens que ya tienen un pool. Estás por debajo del escalón más bajo.

Y un detalle que a un equipo de compliance de exchange le basta para archivar el expediente sin discutirlo: **el modelo de custodia manual** (usuarios depositando en tu wallet personal, tú devolviendo "staking" a mano). Eso solo, sin mirar nada más, es un rechazo.

**Reformula el objetivo.** No persigas "estar listada". Persigue **"tener 1.000 jugadores que vuelven cada semana"**. El listado es una consecuencia de la demanda, nunca una causa. Ningún token se ha salvado por aparecer en un exchange.

---

## 6. Graduar la curva: la aritmética exacta

Calculé esto desde las reservas en vivo, no de artículos copiados:

```
k = 18,340642291 SOL × 919.502.183 tokens = 1,68643e10
La curva completa cuando real_token_reserves = 0
virtual_sol final = 1,68643e10 / 279.900.000 = 60,251 SOL
SOL neto a inyectar = 60,251 - 18,341 = 41,91 SOL
Con el fee del 1% de la curva:  42,33 SOL ≈ $3.116
```

Dos correcciones importantes a lo que dice internet:

1. **No son $69.000.** Esa cifra se repite en todas partes pero asume SOL a ~$168 y una curva con 30 SOL virtuales iniciales. Tu curva arrancó con ~15,96 SOL virtuales y SOL hoy cotiza a **$73,61**. Graduar te cuesta aproximadamente la mitad de lo que dice el folclore: **entre $3.100 y $6.100**.

2. **Graduar no te da un mercado.** Al completar, el market cap resultante sería **$15.845**, con **$3.260 de liquidez** en PumpSwap — y esa liquidez **no la controlas**: pump.fun quema los LP tokens. No puedes retirarla, ampliarla ni recuperar ese SOL jamás.

Con un pool de $3.260, **una sola venta de $100 hunde el precio un 5,8%**. Si además pagas recompensas de $100/mes en tokens que los jugadores venden, el precio cae ~51% al año **solo por tu propio programa de recompensas**, sin ningún otro factor. Eso es aritmética de AMM, no pesimismo.

Y una trampa que conviene conocer: **crear un pool manualmente antes de graduar es una donación a los bots.** Mientras la curva viva, hay 639 millones de tokens comprables por ~42 SOL; cualquier arbitrajista compra barato en la curva y vende en tu pool hasta drenarlo.

La decisión de si gastar ese dinero es tuya y no te la voy a tomar yo. Lo que sí te puedo decir con seguridad es la mecánica: **con 2 usuarios, todo el SOL que inyectes es liquidez de salida para quien quiera venderte el token de vuelta.**

---

## 7. La decisión de fondo: rescatar este token o relanzar

Aquí está la ventaja escondida de tener solo 3 holders: **relanzar te cuesta casi nada**. Compensar a los tenedores actuales con un airdrop cuesta unos 0,006 SOL. En cualquier otro proyecto esto sería impensable; en el tuyo es trivial.

**Rescatar el token actual** conserva la historia, el contrato conocido y las autoridades ya revocadas. Pero arrastras: Token-2022 (fricción en listados), una curva al 19% que cuesta miles de dólares completar, un historial público de 52 días sin trades, y cero diseño de tokenomics — el supply se repartió como se repartió.

**Relanzar** te permite diseñar desde cero lo que hoy no tienes: tesorería separada, vesting, presupuesto de emisión, liquidez propia que **sí controlas**, y un estándar sin fricción. El coste es empezar el contador de historial a cero — que, con 52 días sin actividad, es un contador que ya está prácticamente a cero.

**Mi lectura como arquitecto:** no tomes esta decisión todavía. Tomarla ahora es optimizar la parte del sistema que no es el cuello de botella. El cuello de botella son los jugadores. Pero cuando llegue el momento, sabe que la puerta de relanzar está abierta y es barata — y eso te libera de sentir que tienes que rescatar este token a cualquier precio.

---

## 8. Cómo se diseña un token de juego que no se muere

Los post-mortems son consistentes y vale la pena aprender de ellos en vez de repetirlos:

- **Axie Infinity (SLP):** minteaban 250M/día y quemaban 40M. Ratio 0,16. El token cayó un 94%. Sky Mavis tuvo que eliminar de golpe la emisión de misiones diarias declarando que arriesgaban *"un colapso económico total y permanente"*.
- **StepN (GST):** −95% en 40 días. El fallo concreto: el mercado secundario transaccionaba en SOL, no en GST, así que **el sumidero principal no existía**. Diagnóstico del analista: *"se requiere la entrada de nuevos jugadores para financiar el ROI de los antiguos"*.
- **Sunflower Land**, en cambio, lleva 4+ años funcionando sin VCs. Su mecanismo: las recompensas **no se mintean, se reciclan**. Lo que el jugador gasta vuelve al pool de recompensas, pero solo el 75% regresa a jugadores — **el 25% es sumidero neto permanente**. Y el equipo cobra de las comisiones, así que gana cuando los jugadores **gastan**, no cuando el token sube.

Tienes una ventaja estructural sobre Axie y StepN que quizá no habías notado: **tu supply ya es fijo y la mint authority está revocada. No puedes hiperinflar aunque quisieras.** Tu riesgo no es el mint: es que **tú actúas como faucet vaciando tu propio inventario**, que económicamente es idéntico a mintear.

Las cuatro reglas que yo aplicaría:

1. **Un solo token on-chain + una moneda off-chain.** NO hagas doble token: es lo que mató a Axie y StepN y requiere un equipo haciendo live-ops semanal. DQ vive en tu base de datos, no es transferible entre jugadores y no tiene precio. `$DUENDE` es el único activo on-chain.
2. **Presupuesto de recompensas denominado en USD, no en tokens.** Máximo el 30% de los ingresos **en efectivo del mes anterior**. Este mes, con $0 de ingresos, tu presupuesto correcto de recompensas es **exactamente $0**. Y cuando haya presupuesto, los tokens de recompensa se **compran en mercado abierto**, no salen de tu inventario: así cada recompensa genera presión compradora antes que vendedora.
3. **Reparto pro-rata, no tipo de cambio fijo.** Hoy prometes "1.000 DQ = 1 $DUENDE" fijo, que es un cheque en blanco contra un precio que no controlas. Lo correcto: un pool fijo repartido entre todos los que canjean esa semana. Si canjea el doble de gente, cada uno recibe la mitad. Eso hace la espiral de StepN **matemáticamente imposible**.
4. **Ratio sumidero/emisión ≥ 1,0.** Sumideros concretos para un arcade: reintentos, cosméticos, comisión del 10% para entrar a torneos, power-ups consumibles, un fee del 10–20% en DQ al canjear (que se destruye), y el truco más potente de Sunflower: **monedas de temporada que expiran cada 3 meses** y resetean su supply a cero.

---

## 9. El orden correcto, y por qué

**PRODUCTO → JUGADORES → INGRESOS → LIQUIDEZ → TOKEN**

Por eliminación, con tus propios números:

- **¿Liquidez primero?** Descartado. Cuesta $3.100–6.100 y con 2 usuarios el pool se drena hacia cualquiera que venda. Habrías quemado el dinero para regalarle la salida a los bots.
- **¿Jugadores primero, sin producto?** Descartado. Llevas 52 días sin un trade y tienes 2 usuarios. El problema no es que la gente no te conozca: es que **todavía no hay una razón para volver mañana**.
- **¿Producto primero?** Es el único orden viable, y tiene una propiedad que los otros no: **puedes monetizar con Telegram Stars desde el día 1** sin token, sin liquidez, sin custodia y sin riesgo legal.

Un número para calibrar el salto real que tienes delante. Telegram no cobra revenue share, pero Apple y Google se llevan el 30% de las compras móviles y Fragment un 2–3%. Neto: **~$0,009 por Star en móvil**. Para **netear $100/mes** necesitas ~$147 de compras brutas. Con un ARPPU de $3 y una conversión del 2% (optimista para un arcade), eso son **~2.450 usuarios activos al mes**.

Tienes 2. Ese es el tamaño real del problema, y es un problema de **producto y distribución**, no de tokenomics.

**Hitos para avanzar de fase, no antes:**
- **500 usuarios activos mensuales con retención D7 > 20%** → recién ahí activa la monetización con Stars.
- **$300/mes de ingresos recurrentes durante 3 meses** → recién ahí considera tocar la liquidez del token, financiada con caja operativa y no con tu bolsillo.

**Las tres métricas de cada semana** (ninguna es el precio):
1. **Retención D7.** Por debajo del 20% no tienes juego, y ningún token lo arregla.
2. **Ratio sumidero/emisión de DQ.** Si es < 1,0 dos semanas seguidas, sube precios o baja recompensas **esa misma semana**. Es exactamente la métrica que Sky Mavis ignoró hasta que fue tarde.
3. **Ingresos en efectivo del mes.** Define el presupuesto de recompensas del mes siguiente.

El precio de `$DUENDE` no está en la lista **a propósito**: es un resultado, no una palanca. Mirarlo a diario te empuja a tomar decisiones que destruyen el juego para defender un número que no controlas.

---

## 10. Cambios que ya dejé aplicados

| Archivo | Cambio |
|---|---|
| `functions/api/wallet.js` | Interruptor de emergencia por acción. **`ton_stake` apagado por defecto** (exposición penal). Reversible cambiando una constante. |
| `js/dom-utils.js` (nuevo) | `DQEsc()` compartido para escapar HTML. |
| `telegram/index.html` | Escapado del `username` en los dos rankings — cierra el XSS que permitía robar el `initData` de cualquiera que abriera la pantalla de inicio. |
| `functions/api/helius-verify.js` | `encodeURIComponent` en todos los valores interpolados — cierra la inyección de filtros PostgREST. |
| `.assetsignore` | `*.md` excluido. `LAUNCH-CHECKLIST.md` estaba **público en producción**. |
| `sql/00-diagnostico.sql` (nuevo) | Script de solo lectura para volcar tu esquema real. |

## 11. Lo que necesito de ti para seguir

1. **Ejecuta `sql/00-diagnostico.sql`** en el SQL Editor de Supabase (no modifica nada), pulsa **Download CSV** y pásame el archivo. Con eso escribo el blindaje exacto en vez de adivinar.
2. **Decide sobre el `ton_stake`**: lo dejé apagado. Si quieres reactivarlo, dímelo y lo hago — pero recomiendo antes hablar con un abogado peruano.
3. **Confirma cómo cobras hoy**: si los pagos son 100% manuales, hay endpoints automáticos en el Worker que quizá no usas y que solo añaden superficie de ataque. Podemos apagarlos.

**Lo único que yo haría con dinero antes que cualquier otra cosa:** una consulta con un abogado peruano de fintech/PLAFT (S/ 300–800 la hora exploratoria) con tres preguntas por escrito: ¿mi modelo me hace PSAV bajo el DS 006-2023-JUS?, ¿mis mecánicas caen en la Ley 31557 de juegos a distancia?, ¿qué estructura me permite operar sin disparar el art. 11 de la Ley 26702? Es el mejor ratio riesgo/coste de toda esta lista, por mucho.
