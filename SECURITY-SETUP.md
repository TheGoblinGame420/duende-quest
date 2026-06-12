# 🔐 DUENDE QUEST — Guía de configuración de seguridad

Sigue estos pasos **en orden**. Hasta completarlos, el código nuevo funciona en
modo retrocompatible (menos seguro pero sin romper nada).

## 1. Genera y configura los secrets del Worker

Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
# Genera un secret aleatorio para el webhook (guárdalo, lo usarás en el paso 2)
# En PowerShell:
#   -join ((48..57)+(97..122) | Get-Random -Count 48 | % {[char]$_})

npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
# (pega el secret generado)

npx wrangler secret put SUPABASE_SERVICE_KEY
# (Supabase Dashboard → Project Settings → API → service_role key — ¡NUNCA la pongas en el frontend!)

npx wrangler secret put TELEGRAM_BOT_TOKEN     # si no estaba ya
npx wrangler secret put HELIUS_API_KEY         # si no estaba ya
# Opcional pero recomendado (más cuota para verificar pagos TON):
npx wrangler secret put TONCENTER_API_KEY      # gratis en https://t.me/tonapibot
```

## 2. Re-registra el webhook de Telegram CON el secret

Reemplaza `<BOT_TOKEN>` y `<SECRET>`:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://duende-quest.alfonso12hc.workers.dev/api/telegram-bot" \
  -d "secret_token=<SECRET>"
```

Desde ese momento, solo Telegram (que envía el header
`X-Telegram-Bot-Api-Secret-Token`) puede llamar al webhook. Cualquier otro
request recibe 401.

## 3. Despliega el Worker

```bash
npx wrangler deploy
```

## 4. Ejecuta el SQL de hardening en Supabase

Supabase Dashboard → SQL Editor → pega y ejecuta `sql/security-hardening.sql`.

⚠️ **Hazlo DESPUÉS de los pasos 1-3**: este SQL revoca el RPC
`add_duende_by_tgid` para clientes; si el Worker nuevo no está desplegado con
el service key, las compras TON dejarán de acreditar.

## 5. Verifica

- En el bot: `/buy` → compra un paquete pequeño → deben acreditarse los tokens.
- En la Mini App: compra TON → debe decir "Verificando on-chain..." y acreditar.
- Prueba de ataque (debe fallar): 
  ```bash
  curl -X POST https://duende-quest.alfonso12hc.workers.dev/api/telegram-bot \
    -H "Content-Type: application/json" \
    -d '{"message":{"successful_payment":{"total_amount":1,"invoice_payload":"{\"tokens\":999999}"},"chat":{"id":1},"from":{"id":1}}}'
  ```
  Respuesta esperada: `Unauthorized` (401).

## Qué quedó protegido

| Vector | Antes | Ahora |
|---|---|---|
| Webhook falso con pago inventado | Tokens infinitos | 401 sin el secret |
| Invoice de 1 Star por 999M tokens | Acreditaba el payload | Tokens recalculados server-side |
| Pago repetido (replay) | Acreditaba N veces | Dedupe por charge_id / tx_hash |
| `add_duende_by_tgid` desde consola | Tokens infinitos | RPC revocado para anon |
| Compra TON sin pagar | Crédito client-side | Verificación on-chain (toncenter) |
| Skin sin pagar (insert directo) | Posible | INSERT revocado, lo hace el Worker |
| Skin SOL con `expected_sol` falso | Posible | Precio server-side + firmante + anti-replay |
| Scores absurdos en ranking | Sin límite | CHECK ≤ 5M pts / wave ≤ 500 |

## Pendiente recomendado (siguiente iteración)

1. **Linking de perfiles**: `profiles.telegram_id` se puede actualizar por
   username desde el cliente (riesgo de secuestro de cuenta). Mover al Worker.
2. **Leaderboard firmado**: enviar scores con initData para validar identidad.
3. **Privacidad RLS**: las tablas de compras son legibles por cualquiera
   (solo lectura). Si te importa, filtrar por usuario JWT.
