# Informe de la noche · 24-oct-2026 (01:05 → 05:00)

Producción: **v288** (https://duende-quest.alfonso12hc.workers.dev). Arnés: **817 pruebas en verde**.
Cada versión: arnés + prueba en el navegador (sin sonido) + prueba de humo en producción.

## Lo que se publicó

| Versión | Qué |
|---|---|
| — | El pulso diario del precio ya no se publica solo (ni Telegram ni Discord). `/price` (con botón de comprar) y `/buy` siguen. |
| v280 | **App instalable** desde el navegador: service worker, página sin conexión, botón «⬇ Instalar», atajos a ORIGINS y CLASSIC, iconos maskable. |
| v281 | 14 mejoras de especialistas: carga más rápida, terreno sin tirones, reconexión robusta (2D y 3D), tick del servidor aislado por subsistema, pad táctil deslizable, ORIGINS en horizontal. |
| v282 | **Auditoría de seguridad con 50 agentes**: 21 fallos corregidos (speed hack, flotar, vacío del Abismo validado en servidor, límites anti-abuso de sockets y escrituras, XSS en /telegram/, Modo Dios solo por uid, copia de skins al vincular, skin de pago SOL ajeno). |
| v283 | Ronda de 32 agentes: tutorial de ORIGINS, entregas automáticas, diarias y racha justas para Perú, amigos por enlace, chat al entrar, instalar desde los dos juegos, facturas de Stars autenticadas. |
| v284 | Revisión de todo lo anterior: 13 fallos corregidos (factura de primera compra con Stars, reconexión, planeo, XP en grupo…). |
| v285 | Ronda de 46 agentes: ORIGINS fluido en Android flojo, zoom con dos dedos, entrada sin nombre, chat sin teclado encima, cofres y «Reforjar» en CLASSIC, premios que no se pierden al entrar. |
| v286 | Revisión de v285: 6 fallos. |
| v287 | 14 especialistas nuevos: sensación de combate, IA de monstruos, juego para pocos jugadores, misiones más claras, Torre tras cortes, audio, paneles móviles. |
| v288 | Revisión de v287: sonido en segundo plano y élites del Abismo en la orilla. |

## Pendiente de ti (no se puede desde el código)

1. **Supabase → SQL Editor:** ejecutar `sql/06-profiles-lectura.sql`. Hoy la tabla `profiles` (telegram_id, wallets, saldos) se puede leer entera con la clave pública.
2. **Modo Dios en la web:** si `MMO_ADMINS` tenía tu correo, cámbialo por `web:<tu uuid>` (el log del servidor lo muestra al entrar). Por Telegram sigue igual.
3. **Límite de tasa delante del Worker:** ver la nota de v282 en `SIGUIENTE.md` (requiere wrangler ≥ 4.20 o una regla WAF con dominio propio). No se aplicó a ciegas para no romper el despliegue.
4. **Decidir:** botón «📣 Llamar a mis amigos» (avisa por Telegram a amigos y hermandad desconectados). Está preparado pero no aplicado porque envía mensajes por iniciativa del juego.
5. **R2 para copias:** opcional; hoy la copia diaria va a tu Telegram de admin. Ver la nota de v278.

## Cómo se trabajó

- Equipos de agentes de solo lectura proponían cambios exactos; un verificador escéptico revisaba cada uno contra el código actual.
- Se aplicaban «todo o nada» con comprobación de sintaxis, y tras cada ronda grande se hacía una revisión de código del diff para cazar regresiones.
- No se tocó: token/staking, verificación de pagos SOL/$DUENDE, precios premium.
