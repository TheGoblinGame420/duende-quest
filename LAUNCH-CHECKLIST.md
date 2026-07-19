# 🚀 DUENDE QUEST — Checklist de salida al mercado

## ✅ Listo (verificado)

**Arquitectura**
- Motor de juego único (`js/engine.js`) compartido por web y Mini App — cada fix se hace una vez
- Módulos compartidos: misiones (`js/missions.js`), racha (`js/streak.js`)
- Worker de Cloudflare con API segura + assets; `.git`/SQL/docs excluidos del deploy público

**Seguridad**
- Webhook del bot autenticado con secret (rechaza intrusos con 401 — probado en producción)
- Todos los créditos de $DUENDE pasan por el servidor: initData HMAC + verificación TON on-chain + anti-replay
- Precios e invoices calculados server-side; oferta 2x re-verificada al acreditar
- RLS endurecido, RPC de crédito revocado para clientes, límites anti-cheat en scores
- Scores de la Mini App firmados; linking de perfil sin secuestro por username

**Retención / Monetización**
- Misiones diarias (3/día, deterministas) + racha diaria con bonus creciente — en ambos juegos
- Revivir con 75 DQ (1 vez por partida) — sumidero de economía + "una partida más"
- Recordatorio diario del bot (17:00 UTC) + torneo semanal automático con premios (lunes 12:00 UTC)
- Oferta 1ª compra 2x (bot + banner en Mini App)
- Referidos +500/+500 ya operativos
- Keep-alive de Supabase (no se pausa nunca)

**Gameplay**
- Movimiento libre por todo el mapa; chargers/exploders sin jitter; fantasmas siempre visibles
- Waves cada 30s (antes 40s), spawns más vivos desde wave 1, techo de densidad justo
- Buffs de skins de pago activos también en web (+monedas, +ataque, lifesteal, aura)

**Pulido final (2026-06-12)**
- Tutorial de primera partida (SALTA → ATACA, solo una vez en la vida)
- Biomas: el mundo cambia de color cada 5 waves (5 paletas)
- Cloud save: DQ/nivel/XP/racha guardados en el perfil de Telegram — cambiar de teléfono ya no borra nada, y la racha larga continúa
- `/admin` en el bot: partidas/jugadores de hoy y la semana, compras, retiros pendientes (solo tu ID)
- Eliminada la copia antigua e insegura del backend (netlify/) y el crédito client-side de donaciones

## 📣 Para lanzar (te toca a ti)

0. **Tres pasos de configuración** (una vez):
   - Ejecuta `sql/cloud-save.sql` en el SQL Editor de Supabase (columnas del guardado en la nube)
   - Ejecuta `sql/redeemable-balance.sql` **antes de abrir el canje a nadie** (saldo canjeable server-side; sin esto el canje no funciona)
   - `npx wrangler secret put ADMIN_TG_ID` con tu ID de Telegram (envía `/admin` al bot y te lo dice)

1. **Smoke test humano** (10 min): juega 1 partida completa en Telegram y 1 en web; compra el paquete Starter con Stars (verás el 2x) y confirma que se acredita.
2. **Anuncio**: comparte el bot + tu link de referidos en tus comunidades (Telegram, X, YouTube). Mensaje sugerido: "Juega, sube al TOP 3 semanal y gana $DUENDE reales cada lunes 🏆".
3. **Primer torneo**: el lunes revisa `tournament_awards` en Supabase y celebra a los ganadores en tu canal (screenshot del ranking = contenido gratis).
4. **Retiros**: revisa `withdrawal_requests` (status `pending`) un par de veces por semana y procesa manualmente.

## 🔭 Siguiente iteración (cuando haya jugadores)

- Pase de batalla (gratis/premium con Stars) sobre el sistema de XP existente
- Scores firmados también en web (requiere login obligatorio para rankear)
- Métricas: cuántos juegan/día, conversión de la oferta 2x, uso del revive → ajustar precios DQ
- Más contenido: nuevo jefe cada 2-3 semanas (los assets de enemigos existentes se pueden recolorear)
