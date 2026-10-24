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
- **Necesita decisión del dueño** (sin esto, Pago y NFT/web3 no pasan de ~6-7): un solo catálogo de precios (hoy US$25-250 en la web frente a US$2-20 en el juego), entrega automática de pagos ya verificados, quitar el staking oculto con APY de la web, NFT real (cNFT) o dejar de mencionarlo, y skins solo estéticas también en PvE.
