# Traspaso — qué falta para dejar el juego listo para publicidad

Documento para retomar el trabajo en otra conversación. Todo lo de aquí está
diagnosticado con datos, no son ideas sueltas: viene de un equipo de agentes
(diseño móvil, dificultad, monetización Solana y QA) que auditó el código real,
más 50 partidas simuladas con restricciones de móvil.

## Cómo medir el juego (usa esto, funciona muy bien)

Conducir el juego desde la consola del navegador con un jugador automático:
llamar `startGame()` y luego `update()` en bucle. **El `requestAnimationFrame`
no corre si el panel del navegador está oculto**, así que hay que llamar
`update()` a mano. Las capturas de pantalla fallan por lo mismo; la alternativa
para ver arte es componer los PNG con PIL a los tamaños del motor y mirar el
resultado.

Perfiles de jugador móvil realistas (tiempo de reacción en frames, no
decisiones frame a frame, y máximo 2 dedos simultáneos):

    novato  {reaccion:26, precision:.55, agresividad:.5}
    casual  {reaccion:18, precision:.72, agresividad:.6}
    bueno   {reaccion:13, precision:.85, agresividad:.75}
    experto {reaccion:9,  precision:.94, agresividad:.85}
    pro     {reaccion:7,  precision:.98, agresividad:.9}

Última medición (10 partidas por perfil): novato 101 s / oleada 3,9 · casual
115 s / 4,3 · bueno 212 s / 7,6.

---

## 1. Controles: de 5 botones a 3 zonas — PRIORIDAD MÁXIMA

**El problema medido:** el dash se usa 0 veces (novato) a 12,9 (pro) por
partida. No es que sea malo: pierde una subasta contra el ataque por el mismo
pulgar. En 375 px, el pulgar derecho sirve a ▶, ⚔ y 💨 con 129 px de recorrido
entre extremos, y el ataque —que se pulsa 322 veces en una partida pro— es el
objetivo más pequeño (60,5 px) y el más lejano del reposo.

Además `dash()` usa `PL.dashDir = PL.facing`: es un modificador de la
**dirección**, y está en el lado del ataque. Está en el pulgar equivocado.

**Diseño concreto para 375×812**, midiendo desde el borde inferior seguro:

- **Pad de movimiento**: rectángulo x 8..172, alto 186, esquinas 18. Origen
  relativo al dedo (no hay stick dibujado hasta que tocas).
  - zona muerta |dx| ≤ 12 → parado; 12..34 → andar; > 34 → correr
  - **dash = flick**: desplazamiento > 55 px en < 140 ms → `dash()` tras forzar
    `PL.facing`, y reanclar el origen para seguir corriendo. Confirmar con
    `_hap('medium')`: un gesto sin háptica se siente roto.
- **Botón ataque**: círculo Ø112, centro x=306, 90 px sobre el borde seguro.
  Es la casa del pulgar y la acción más pulsada: +57% de área frente a hoy.
- **Botón salto**: círculo Ø96, centro x=232, 196 px sobre el borde. Quedan
  25 px de separación con el de ataque: no se pulsan por error.
- **Botón item contextual**: Ø68, solo visible cuando hay item disponible y
  (`PL.hp < 40 || bossActive || enemies.length >= 6`).

**Prerrequisitos sin los cuales el pad no funciona en Telegram:**
1. `touch-action: none` en el pad y `e.preventDefault()` en `touchmove`.
2. `html,body{overflow:hidden}` mientras `state === 'playing'` (hoy es
   `overflow-y:auto` y el arrastre vertical hace scroll de la página).
3. `tg.disableVerticalSwipes()` junto a `tg.expand()` — hoy un gesto hacia
   arriba **minimiza la Mini App** en mitad de la partida.

---

## 2. Rendimiento: el HUD y el dibujado

- **~1.140 `getElementById` por segundo**: `updateHUD` + `updateHpHUD` +
  `updateItemHUD`×4 se llaman cada frame = 19 búsquedas y ~30 escrituras por
  frame. Cachear los nodos en un objeto al cargar y escribir solo si el valor
  cambió. Lo peor es `f.style.background = 'linear-gradient(...)'` reasignado
  cada frame con `transition: width .15s`: la transición se reinicia 60 veces
  por segundo y la barra de vida va siempre 150 ms por detrás. Pasarlo a tres
  clases CSS (.hp-ok/.hp-mid/.hp-low).
- **Misiones y logros escriben en disco por cada moneda y cada kill**:
  `js/missions.js` hace `save()` + `render()` con cualquier progreso, y el
  panel es visible durante la partida en la Mini App. Marcar `_dirty` y volcar
  como mucho una vez por segundo, más un volcado forzado al morir.
- **Basura por frame en `draw()`**: un `createLinearGradient` para el fondo y 5
  `createRadialGradient` para las nubes, cada frame. Cachearlos como ya se hace
  con `_vignette`. Y `bullets.filter(...)` se llama dos veces por frame.

---

## 3. Estados rotos que quedan

- **`hideAll()` no cierra los overlays nuevos**: `ov-descanso` no tiene la clase
  `.ov` y `ov-mejora` lleva `display:flex` inline, que gana a `.ov{display:none}`.
- **Desde GAME OVER se llega al menú sin pasar por `toMenu()`**: los botones
  "← VOLVER" de las tiendas hacen `showOverlay('ov-start')`, así que te quedas
  en el menú con `state === 'dead'`, el canvas congelado y sin modo atracción.
  Cambiarlos todos por `toMenu()`.
- **El menú de atracción pinta los cadáveres de la partida anterior**:
  `arrancarAtraccion()` debe limpiar `enemies`, `coins`, `bullets`, `chests`,
  `weaponDrops`, `powerups`, `fTexts` y restaurar `PL.hp`.
- **`endGame()` no corta el frame**: se siguen creando entidades y sumando
  puntos después de morir.
- **Girar el móvil deja la resolución equivocada**: `W` y `H` son `const`
  calculadas una sola vez. Lo coherente es forzar vertical con un overlay
  `@media (orientation:landscape)`.
- **Un `<audio>` nuevo por cada efecto**: `cloneNode()` en `reproducir()` crea
  más de mil elementos por partida. En iOS hay tope de decodificadores y al
  pasarlo el juego se queda mudo sin error. Usar un pool de 4 por efecto.

---

## 4. Contenido que falta (diseñado, sin implementar)

- **Estado de carga**: se lanzan 28 peticiones sin ninguna UI, y `drawSpr` hace
  `return` si la imagen no está lista. Se puede empezar una partida de sprites
  invisibles. Contador de progreso y botón JUGAR deshabilitado hasta el 100%.
- **Texto del canvas ilegible**: se usa `rem` en `cx.font`, que se resuelve
  contra los 16 px de la raíz. El nombre del élite acaba midiendo **3 px** en
  pantalla. Pasar a píxeles absolutos: 10px élite, 14/19px textos flotantes.
- **Tres jefes con fases y avisos de 40-60 frames**.
- **Cuatro armas**: `weaponBuff` existe y no hace nada — enseña el cartel
  "+COMBO RANGE!" y no toca la jugabilidad.
- **Razón obligatoria para subir a las plataformas**: hoy el premio por subir
  150 px es una moneda idéntica a las que caen solas.
- **Ataque aéreo en móvil**: `airSlamNeedsKey:false` hace que *cualquier* ataque
  en el aire cayendo sea un slam, y el slam ignora las plataformas. Exigir
  `PL.vy > 5` para el slam.

---

## 5. Monetización — el orden correcto

**Donaciones:** funcionan a medias y se dejan como están por ahora. La
transferencia a `B6pLnZ...` es real y el SOL llega, pero solo desde la landing
en escritorio con Phantom, el `$DUENDE` prometido **nunca se acredita** (no hay
verificación en servidor) y la tabla `donations` no tiene definición en `sql/`.

**Vender skins en Solana:** el 80% está construido. `helius-verify.js` ya
verifica pagos on-chain con precio en servidor y anti-replay. Falta un
`reference` de Solana Pay único por compra, porque la verificación actual
empareja por wallet y monto y eso permite reclamar el pago de otro. Comisión
0%, coste de red ~$0,0004 por pago. Ni Helio (2%) ni Coinflow aportan nada a
esta escala.

**Restricción dura:** las Blockchain Guidelines de Telegram prohíben distribuir
o promocionar tokens de otras cadenas dentro de una Mini App. La venta en
Solana solo puede vivir en la web; dentro de Telegram, Stars.

**Sobre "salir de pump.fun":** el token tiene ~$1.473 de capitalización, la
curva sin completar y 3 holders reales. Migrar a un pool propio no crea
demanda. El orden que funciona: skins a 1-5 USD y Stars son la monetización; el
token es consecuencia de tener jugadores, no la forma de conseguirlos.

---

## 6. Antes de pagar publicidad

1. Controles de 3 zonas (sin esto, el jugador de móvil no puede jugar bien).
2. Estado de carga (el jugador nuevo con red lenta se va).
3. Los estados rotos del punto 3 (encierran al jugador o le muestran pantallas
   muertas).
4. Rendimiento del HUD (tirones en gama media).
5. Términos de servicio y privacidad — ver `ESTRATEGIA-TOKEN.md`.

Sin los cuatro primeros, cada euro de publicidad trae jugadores a un juego que
se siente roto en el primer minuto, y la retención de esos jugadores es cero.
