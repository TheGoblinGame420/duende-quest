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

## Pulido de la v392 (15-nov, agente r2-chicha): en master, sin publicar
Revisado con fotos en 360x740, 412x915, 740x360 y 1280x720 (primera partida, paneles, granja, modales, sonido, sin red, guardado):
- Primer minuto: el jugador nuevo que no tocaba nada veía la olla lista sin saber servirla y los clientes se iban «¡No hay chicha!». Ahora la guía marca «¡Toca para servir!» en las 3 primeras tandas, y un duende que roba tiene prioridad («¡Tócalo!» aunque aún no hayas removido).
- «Cómo jugar» con el celular acostado dejaba el botón Entendido fuera de la pantalla (no se podía cerrar): los modales tienen ahora scroll.
- Granja con el celular acostado: dos columnas (antes las parcelas quedaban tapadas). Los textos −25 / −0:30 de sembrar y regar salían fuera de la pantalla y empujaban la granja: arreglado.
- HUD: sonido y menú no se encogen (zona de toque 46 px); en celulares angostos las monedas se abrevian (12,3k) y el chip de vasos se oculta (se ve en las jarras). Antes, con cifras grandes, el botón de menú quedaba fuera de la pantalla.
- Avisos que duran según su largo; sin conexión: un aviso al perderla y otro al volver; vender o cambiar sin red ya no falla en silencio. Sonido que se reanuda si el celular lo suspendió.
- Ritmo (jugador simulado): herencia a los 12,7 min (activo) y 14,8-15,5 min (toca poco): igual que antes.

## Tercera pasada (15-nov, agente r3-chicha): rendimiento, celular acostado, descarga y sonido; en master, sin publicar
- Dibujo: ningún filtro de canvas por cuadro (noche, duende dorado, skins y destello del golpe usan copias hechas una vez; el destello se suma con 'lighter' y da la misma matriz de color), plaza reducida una vez al tamaño de la pantalla, nubes y halos pre-dibujados, un solo requestAnimationFrame, formateador de números único. Con la granja o la portada encima la escena no se pinta. Granja abierta con CPU x4: 93 drawImage por cuadro → 4 y 17 → 41-58 fps. Si el juego no llega a ~40 fps, el lienzo baja solo de 2 a 1,5 y 1,25 píxeles por punto.
- Celular acostado (alto ≤ 500 px): escena a la izquierda a todo el alto (740x360: 304x360, antes 250x297), HUD y ventanas a su derecha (se sigue jugando con Mejoras abierta) y la barra en columna al borde. Portada en dos columnas. De pie y en PC igual que antes.
- Descarga: primero los dibujos que se ven con tu partida; el otro fondo, los otros toldos, la hoja de la chichera si juegas con el chichero y los niveles de herramientas que no tienes bajan después. 3G lento: escena completa 56 s/2,6 MB → 44 s/1,9 MB. Los webp ya estaban bien comprimidos (recomprimir ahorraba < 3 % con pérdida): no se tocaron.
- Sonido: el mismo sonido no se repite antes de 45 ms, máximo 10 voces y compresor suave (30 toques juntos: 33 voces → 2); con el audio dormido solo uno queda en cola.
- Probado: partida guardada por v393 abre y sigue igual; arnés 1512 bien, 0 mal; ritmo con jugador simulado: herencia a los 12,3 min (activo; la v393 de antes, 12,7 en la misma máquina) y 12,6 min (toca cada 8 s).
