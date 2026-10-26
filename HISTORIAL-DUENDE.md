# Duende Quest · historial único del proyecto

*Junta en un solo sitio lo que se hizo en las dos conversaciones de Claude sobre el juego. No se publica en la web (`*.md` está en `.assetsignore`).*

- **Conversación A:** «Juego: seguridad, login, skins crypto y gráficos», la original. Trabajó del mundo 3D hasta la v264 y después de la v266 a la v289.
- **Conversación B:** el asedio del Núcleo, la v265. Se separó de la A el 23-oct. Desde el 24-oct es la conversación principal.

Producción: https://duende-quest.alfonso12hc.workers.dev

- **$DUENDE CLASSIC** (2D): `/mmo/`
- **$DUENDE ORIGINS** (3D): `/mundo/`
- **Inicio:** `/inicio/`

Un mismo personaje, oro y skins valen en los dos juegos. Es una beta privada con unos 10 jugadores invitados.

## Línea de tiempo

| Versiones | Qué | Conversación |
|---|---|---|
| ≤ v260 | El mundo abierto 3D estilo WoW/AION: clases, combate, física, cueva, vuelo, editor de aspecto y jefe mundial | A |
| v261–v262 | Abismo de Éter: islas flotantes, facciones Luz y Sombra, PvP de facciones, Puntos del Abismo, 8 rangos y botón 3D en Telegram | A |
| v263 | Partículas en la GPU, resplandor, resolución dinámica y FOV según la velocidad | A |
| v264 | Arte y sonido CC0 de Kenney y OpenGameArt: flora con LOD, pueblo, bastiones, pasos y voces | A |
| v265 | Asedio de la Fortaleza del Núcleo: puerta, Guardián, máquinas de asedio, dueño por facción y premios | **B** |
| v266–v269 | Telegram nativo, duende fiel al arte 2D, 3D más visible, racha de 7 días y pase de temporada | A |
| v270–v272 | Hermandades y ranking en 3D, nombres CLASSIC y ORIGINS, «una skin, dos juegos» y pantalla `/inicio/` | A |
| v273–v279 | Informe de 50 agentes (4,8/10) y su plan: PvP sin ventaja de pago, arreglos sociales en ORIGINS, Maestría pasado el nivel 60, rescate de invitados, cofres, élites e invasiones en 3D, temporadas del Abismo, copias de seguridad y vincular Telegram con correo | A |
| v280–v289 | La noche del 24-oct: app instalable, auditoría de seguridad con 50 agentes, 4 rondas de mejora con más de 140 especialistas y 3 revisiones. Detalle en `INFORME-NOCHE-24OCT.md` | A |
| v290 | HUD compacto en Telegram, zona de misión que explica qué hacer, chat antiestafa con /ignorar y /reportar, PvP sin ventajas compradas y arreglos de QA | **B (principal)** |
| v291 | Encargos de zona en ORIGINS: 50 misiones variadas (hito, recolección, vuelo, cofre y jefe) con logros de explorador | **B** |
| v292 | Un solo catálogo de precios (US$1-15 las skins con oro), entrega automática de pagos ya verificados y fuera el staking oculto de la web (autorizado por el dueño) | **B** |
| v293 | HUD mínimo en móvil/Telegram y la leyenda del Cántaro (chicha morada, imágenes del dueño) | **B** |
| v294 | Cielo con degradado y nubes, recarga automática con versión nueva | **B** |
| v295 | Todas las ventanas adaptadas al móvil, leyenda en cada sesión, mascota $Duende | **B** |
| v296 | Chicha Nv 60 = 2 litros siempre a la vista (3D y 2D), XP más lenta desde Nv 10, chat móvil con ➤, poncho | **B** |
| v297 | Lore por zona, PNJ con frases, secretos de hitos, aventureros PNJ en la plaza | **B** |
| v298 | Inicio arreglado (JUGAR), vacío del Abismo, canal de chat, reportes, baneo heredado, título sin spam | **B** |
| v299 | Planeo sin atajos, invisibles, límites de reportes y vinculación, invasiones justas, cerrojo de entrega | **B** |
| v300 | Ronda de 22 agentes jugando: tutorial móvil, cámara, FOV, ATACAR, márgenes Telegram, leyenda/diario, Ira, Bola de Fuego, Polimorfia, Carga | **B** |
| v301 | Pedazos del Cántaro por jefe de zona (leyenda N/10), aviso sin monstruos, bienvenida visible | **B** |
| v302 | 2.ª ronda de jugadores: tareas sin CLASSIC, semanales, siguiente misión, premios por ayuda real, sacerdote, pícaro, pase móvil, cueva repetible | **B** |
| v303 | 3.ª ronda: planeo al agotar alas, nombres con espacios, compras en el pueblo, facción confirmada, sin vacío, Guardián, líder de grupo | **B** |
| v304 | 4.ª ronda: pesca/recolección, monturas ganadas, botín claro, vender comunes seguro, elixir suma, sin revivir gratis | **B** |
| v305 | Chicha en ORIGINS (3 premios, +N), final de reliquias, títulos, talentos, Agilidad, 24 por IP / 60 entradas | **B** |
| v306 | 30 altas por IP, Telegram caducado sin invitado silencioso, enlaces con sesión, Atrás, rescate con copia | **B** |

## Reglas del dueño (siguen vigentes)

- Trabajo autónomo: mejorar, probar y publicar sin preguntar.
- No tocar el token ni el staking, ni la verificación de pagos SOL/$DUENDE, ni los precios premium.
- Telegram queda estable. El precio solo sale con `/price` y `/buy`.
- Probar siempre con el sonido apagado: el dueño usa la web mientras se trabaja.
- El riesgo legal no es prioridad (beta privada).

## Pendiente del dueño

1. Ejecutar `sql/06-profiles-lectura.sql` en Supabase.
2. Cambiar `MMO_ADMINS` a `web:<uuid>`.
3. Decidir el botón «Llamar a mis amigos».
4. Opcional: R2 para las copias de seguridad.

## Nota del juego

| Fecha | Nota | Fuente |
|---|---|---|
| 23-oct (antes de la v272) | **4,8 / 10** | 50 agentes, 10 áreas × 5 perspectivas (`INFORME-50-AGENTES.md`) |
| 24-oct (v289) | **5,7 / 10** | 5 evaluadores con el mismo baremo: MMO 5,9 · F2P 5,9 · QA 5,8 · casual 5,7 · web3 5,1 |

### Qué falta para un 9 real (según la reevaluación)

- **Se puede hacer sin decisión del dueño:** misiones variadas en ORIGINS (no solo «mata N»), talentos con elección real, Torre/Desafíos o segunda mazmorra en 3D, grupos que sobrevivan a los despliegues, pase con premio distinto cada mes, login propio en ORIGINS, no caer a invitado si falla el login, prueba de carga del 3D, recibos de compra visibles.
- **Necesita decisión del dueño:** ~~catálogo único~~, ~~entrega automática~~ y ~~staking de la web~~ (hechos en v292). Quedan: NFT real (cNFT) o dejar de mencionarlo en la hoja de ruta, la venta SOL→$DUENDE a tasa fija de la FAQ (token) y skins solo estéticas también en PvE.
