# Chicha Wars · nota de avance (para retomar si se cortan los créditos)

Pedido del dueño (14-nov-2026): «mejora la jugabilidad y experiencia de juego, crafteo, mejoras, progresión y pase de batalla; recolecta info en línea y aplícalo; si se acaban los tokens deja una nota».

Última versión publicada: **v386**: taller de pociones, fama, herencia, desafíos del pase y logros.

## Plan de esta ronda
1. [x] Crafteo: ingredientes (piña, manzana, canela, limón, azúcar) que sueltan los duendes y vende el Agricultor; Taller con pociones temporales (más vasos, cocción ×2, clientes ×2, precio ×2, trampa para duendes).
2. [x] Progresión: Fama del puesto (niveles con premio) y Herencia de la Abuela (prestigio: reinicia el puesto a cambio de Recetas Secretas = +% permanente).
3. [x] Pase: desafíos de temporada que dan XP, «Reclamar todo» y vista del próximo premio.
4. [x] Logros con premio.
5. [x] Probar en celular (fotos con cdp), versión, verificar, push y prueba de humo.

## Estado
(se actualiza al terminar cada punto)
- 14-nov: puntos 1-4 escritos en código (sin publicar): datos.js (INGREDIENTES, POCIONES, FAMA, HERENCIA, DESAFIOS, LOGROS), juego.js (Taller en Mejoras, fama en Cocina, herencia en «Puesto y ollas», logros en Misiones, desafíos + «Reclamar todo» en Pase, ingredientes en Mercado), servidor maxEst 16000. Parche: scratchpad/cw/parche_r6.py.
- Falta: medir ritmo (primera herencia ~15-20 min; ajustar HERENCIA.div), fotos con cdp, versión v386, verificar, commit, push y humo.
- 14-nov: ritmo medido con jugador simulado (scratchpad/cw/ritmo.mjs): Fama 5 a los ~9 min, herencia ×2 a los ~16 min, ×3 a los ~24 min. Publicado v386 (commit 4b6a975). Ronda terminada.

## v392 (15-nov, agente cw-cierre): cerrada en código, falta publicar
Retomada la v392 que otra sesión dejó sin commit. Commits en master (sin push, sin subir ?v=):
- Granja como pantalla aparte (botón en la barra), Taller con utensilios que se fabrican con la cosecha, se gastan y se reparan, clavo de olor (cultivo + ingrediente), duendes más duros que roban monedas, barra Granja/Cocina/Taller/Mejoras/Tienda/Misiones. El Pase se abre desde Misiones y desde la estrella del HUD; las Skins, desde Mejoras › Skins.
- Arte que faltaba, hecho con las herramientas del repo: granja_fondo.webp y cul_clavo_1/2.webp (tools/cw_chacra_blender.py, nuevo tercer argumento para renderizar solo unas colecciones), ing_clavo.webp (tools/cw_recortar.py clavo: sale de la lámina del dueño; la canela queda sin clavos), chichera_hoja.webp/.json (12 poses de la abuela) y la plaza a 1080x2000 (cw_fondo_blender.py con alto 2000).
- Ritmo medido con jugador simulado (scratchpad .../cw-cierre/ritmo3.mjs) contra v391: el jugador activo hereda igual (12,9-13,4 min contra 13,4). El que toca poco (cada 8 s) se atascaba con la v392 tal como estaba (2 de 3 partidas sin salir: utensilios gastados, sin monedas para repararlos). Ajustes: utensilios duran el triple, gastado = pelea a medias (no se apaga), el robo de monedas es como mucho el 3 % de lo que tienes y la vida de los duendes sube +1 cada 5 oleadas (no cada 4). Tras el ajuste: 4 de 4 heredan (14-17 min; v391: 14,7-18,6).
- Arreglado de paso (también estaba en v391 publicada): sin las imágenes de los duendes cargadas, el Duende dorado tiraba el dibujo de respaldo y congelaba el juego. Ahora el bucle sigue aunque un cuadro falle.
- Falta: que el integrador suba ?v= y publique; ver con el dueño si la abuela de la hoja de poses (chichera_hoja) debe ser también la de la portada y las Skins (ahí sigue chichera_maestra).
