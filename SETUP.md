# DUENDE QUEST — Setup Guide

## Fase 1: Web con Rankings Globales + Auth

### Paso 1 — Crear proyecto Supabase

1. Ve a **https://supabase.com** → New Project
2. Ponle nombre: `duende-quest`
3. Elige una región cercana (ej. `South America (São Paulo)`)
4. Guarda la contraseña de la base de datos

### Paso 2 — Ejecutar el schema

1. En el dashboard de Supabase → **SQL Editor**
2. Pega el contenido de `supabase-schema.sql`
3. Haz click en **Run**

### Paso 3 — Obtener las keys

1. Ve a **Project Settings → API**
2. Copia:
   - **Project URL** → `https://xxxx.supabase.co`
   - **anon public key** → `eyJhbG...`

### Paso 4 — Configurar el juego

Edita `js/config.js`:
```js
window.SUPABASE_URL = 'https://xxxx.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbG...';
```

> ✅ La anon key es segura para poner en el cliente — Supabase usa
> Row Level Security (RLS) para proteger los datos.

### Paso 5 — Deshabilitar confirmación de email (recomendado para juego)

1. Supabase → **Authentication → Providers → Email**
2. Desactiva: **Confirm email**
3. Esto permite que los usuarios jueguen de inmediato sin verificar email

### Paso 6 — Deploy

```bash
git add .
git commit -m "feat: Supabase auth + global leaderboard"
git push
```

Netlify detecta el push y despliega automáticamente.

---

## Fase 2: Telegram Mini App + TON (próximo)

### Estructura prevista

```
telegram-miniapp/
├── index.html       ← version optimizada para Telegram
├── ton-connect.js   ← TON wallet integration
└── rewards.js       ← sistema de rewards en TON
```

### Mecánica de rewards

- Cada partida completada en el Mini App genera **DQ Points**
- Los puntos acumulados se canteen por **TON**
- TON puede intercambiarse por **$DUENDE** (token Solana)

### Contratos necesarios

- [ ] Smart contract en TON para el sistema de rewards
- [ ] Bridging TON ↔ $DUENDE (via swap o contrato dedicado)

---

## Fase 3: NFT Skins (Solana)

### Skins NFT ya diseñadas

- `duende_comun.png` — skin base
- `skin_legendariafull.png` — legendaria
- `skin_necromancer.png` — necromancer

### Integración prevista

1. Usuario conecta Phantom Wallet
2. El juego consulta la wallet via Helius API
3. Si posee NFT de $DUENDE collection → se desbloquea la skin
4. La skin se aplica en el canvas del juego

### Setup Helius (para verificar NFTs)

```js
const HELIUS_API_KEY = 'YOUR_HELIUS_KEY';
// GET https://api.helius.xyz/v0/addresses/{wallet}/nfts?api-key={key}
```
