# DQ Iconos · guía de estilo y de trabajo

"DQ Iconos" es la fuente de iconos de Duende Quest. Sus glifos ocupan los MISMOS puntos de código que los emojis y símbolos que ya usa el juego, así que cada emoji del texto pasa a dibujarse como un glifo serio, de un solo color, que toma el color del texto. No se toca ningún texto del juego: solo se dibuja.

## 1. Cómo se trabaja (dibujante)

1. Abre tu lote: `tools/iconos/lotes/lote-NN.json`. Cada glifo trae `nombre`, `significado` (qué es EN EL JUEGO), `dibuja` (qué hay que dibujar) y `ctx` (frases reales donde sale).
2. Crea `tools/iconos/src/<nombre>.svg` (el nombre exacto del lote).
3. Mira tu trabajo: `node tools/iconos/hoja.mjs <carpeta temporal>/hoja.png lote-NN` (o nombres sueltos). Abre el PNG y míralo de verdad: lo que manda es el **16 px ampliado** y la fila de 14-32 px, no el dibujo grande.
4. Corrige y repite hasta que cumpla la lista del punto 6. Entonces pon `"hecho": true` en tu lote.
5. No ejecutes `construir.mjs` en paralelo con otros dibujantes (escribe la fuente); lo hace el integrador al final. No toques `mapa.json`.

Los iconos ya hechos en `src/` son el patrón de calidad. Antes de empezar, mira la hoja de estos: `espadas-cruzadas escudo calavera moneda vaso-chicha candado mochila trofeo brujula grupo`.

## 2. Formato del SVG (obligatorio)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <path fill="#000" d="..."/>   <!-- tinta -->
  <path fill="#fff" d="..."/>   <!-- talla: hueco pintado encima -->
</svg>
```

- Solo `#000` (tinta), `#fff` (talla) y `none`. Lo último pintado gana. El fondo es blanco.
- Vale todo lo que Chrome dibuja como vector: formas, trazos con grosor, `stroke-linejoin`, transformaciones, `<use>`, `clipPath`.
- **Prohibido**: grises, degradados, opacidades, filtros, máscaras, `<text>`, `<image>`, `<style>`. `hoja.mjs` y `construir.mjs` avisan si lo detectan.
- Truco de la casa: para separar una pieza de la que tiene detrás, píntala primero en blanco con `stroke="#fff" stroke-width="6"` y luego en negro encima (deja un filete de 3). Ver `espadas-cruzadas.svg` y `grupo.svg`.

## 3. El estilo: «talla andina»

Iconografía de MMORPG serio: **siluetas llenas y rotundas con uno o dos detalles tallados en negativo**, como un sello o una pieza de metal repujado. Sabor andino donde el concepto lo pide (chakana, cántaro, quipe, chullo, pututu, tinya, Inti), nunca de adorno.

- **Una sola idea por icono.** Si necesita dos objetos para entenderse, elige el más reconocible.
- **Silueta primero.** Tápalo de negro entero: ¿se sigue sabiendo qué es? Si no, cambia la forma, no añadas detalle.
- **Vista**: objetos de frente y simétricos (escudo, candado, trofeo); armas y herramientas en diagonal a 45° con la punta arriba a la derecha; animales de perfil mirando a la derecha; jefes y caras de frente.
- **Ángulos**: 0°, 45° y 90° siempre que se pueda. Metal y piedra con aristas vivas; cuero, barro, tela y seres vivos con curvas tensas (pocas, amplias).
- **Esquinas exteriores**: redondeo mínimo, de 1 (se consigue con `stroke="#000" stroke-width="2" stroke-linejoin="round"` sobre la silueta) o radios de 2 a 6 en cuerpos blandos. Nada de formas «globo».
- **Personas**: cabeza cúbica de esquinas suaves (la del duende), hombros anchos. Las orejas en punta se reservan para `cabeza-duende` y las caras. Manos sobrias, tipo guante.
- **Nada de**: caritas redondas, ojos de dibujo animado, brillos de «sticker», perspectivas forzadas, texto, contornos finos, objetos modernos cuando hay equivalente del mundo (tienda = puesto de mercado, bombilla = candil).
- **La chakana tallada** (cruz escalonada con centro macizo) es el sello de la casa: úsala solo donde significa valor o pertenencia (moneda, escudo). No la repitas en todo.

## 4. Reglas medibles (pictogramas)

| Regla | Valor |
|---|---|
| Rejilla | 64 × 64 |
| Margen de seguridad | nada de tinta a menos de **4** del borde (la hoja lo marca en rojo por debajo de 3,7) |
| Tinta mínima | ninguna pieza ni trazo de menos de **3** de grosor; trazos de contorno, **5 a 7** |
| Talla mínima | ningún hueco ni filete de menos de **3**; los que deben verse a 16 px, **4 o más** |
| Peso (tinta sobre la caja) | **30-45 %**; admisible 24-50 % (la hoja marca en rojo fuera de ahí). Formas delgadas por naturaleza (rayo, llave) deben engordarse hasta llegar a 24 % |
| Tamaño óptico | ocupa unos 52-56 de los 64 en su dimensión mayor; centrado en (32, 32) |
| Detalles tallados | dos como mucho, y que al perderse a 14 px el icono siga leyéndose |

A 16 px, 1 píxel = 4 unidades. Un filete de 3 se ve como una sombra gris: sirve para separar piezas, no para contar algo importante.

## 5. Símbolos de texto (`"texto": true` en el lote)

Flechas, visto, aspa, triángulos, puntos, estrellas, signos: van DENTRO de frases («A → B», «★★★☆☆»), así que pesan como una letra en negrita, no como un pictograma.

- Trazo **7** (flechas) u **8** (visto, aspa, más, menos), extremos rectos, uniones en inglete.
- Centro vertical en **y = 34** (no 32): queda a la altura del ojo de las minúsculas y sirve con mayúsculas.
- `ancho` en el lote = ancho de la celda en unidades de rejilla, centrada en x = 32 (64 si no se dice). El dibujo debe caber en esa franja con 2 de aire a cada lado. Ejemplo: `barra-llena` tiene `ancho: 22` y ocupa de x = 26 a 38.
- Las parejas llena/hueca (estrella, casilla, punto/aro, barra) comparten contorno exterior exacto.
- Las ocho flechas son la misma girada; no las redibujes.

## 6. Lista de comprobación antes de marcar «hecho»

- [ ] A 16 px (el ampliado ×5) se reconoce sin leer el nombre.
- [ ] No se confunde con ningún otro icono de su lote a 16 px (compáralos en la misma hoja).
- [ ] Tinta y margen sin rojo en la hoja.
- [ ] En oro sobre el fondo del juego se ve tan bien como en blanco.
- [ ] Mismo «tamaño aparente» que los ejemplos de la casa puestos al lado.
- [ ] Sin avisos de formato al generar la hoja.

## 7. Cómo funciona la fábrica

| Archivo | Qué hace |
|---|---|
| `src/<nombre>.svg` | Un icono. Es la única fuente de verdad del dibujo. |
| `mapa.json` | Lista de glifos: `nombre`, `cps` (puntos de código que lo usan), `significado`, `lote`, y si es símbolo de texto `texto` y `ancho`. Un glifo por concepto del juego; varios emojis pueden compartirlo. |
| `lotes/lote-NN.json` | El encargo de cada lote para los dibujantes (con `dibuja`, `ctx`, `hecho`). |
| `rasterizar.mjs` | Chrome dibuja cada SVG a 1024 px sobre blanco (con caché, en la carpeta temporal del sistema). |
| `fuente.py` | Umbral al 50 %, contornos subpíxel (`skimage.find_contours`), simplificación (0,8 unidades de 1024) y fuente TrueType con fontTools. |
| `construir.mjs` | **El único comando**: `node tools/iconos/construir.mjs` → `assets/ui/dq-iconos.woff2` + `resumen.json` + resumen en pantalla (`--faltan` lista lo pendiente). |
| `hoja.mjs` | Hoja de prueba desde los SVG, sin reconstruir la fuente. |
| `muestra.html` | Página de muestra de la fuente real (se sirve desde la raíz del repo). |
| `probar.mjs` | `node tools/iconos/probar.mjs captura.png [--movil]`: abre la muestra en Chrome sin ventana y dice qué fuente usó Chrome para cada icono, con y sin U+FE0F. |

Métrica de la fuente: 1024 unidades por em; cada icono ocupa una caja de 1 em colocada de y = −154 a y = 870 (centrada con las mayúsculas); avance = `ancho`·16 + 76 (1100 para un icono normal); ascendente 880, descendente −144, interlínea 0, para que una línea con iconos no crezca. `cmap` BMP + astral, secuencias con U+FE0F y U+FE0E (formato 14) y glifo vacío de avance 0 para U+FE0F, U+FE0E y U+200D.

Un punto de código sin SVG no entra en la fuente: el navegador lo sigue pintando con el emoji de siempre hasta que se dibuje.
