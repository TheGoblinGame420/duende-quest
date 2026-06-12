-- ═══════════════════════════════════════════════════════
-- DUENDE QUEST — SECURITY HARDENING
-- Ejecutar en Supabase SQL Editor DESPUÉS de desplegar el Worker
-- actualizado (functions/api/wallet.js) y configurar SUPABASE_SERVICE_KEY.
--
-- ⚠️ ORDEN IMPORTANTE: si ejecutas esto antes de desplegar el Worker
-- nuevo, las compras TON de la Mini App dejarán de acreditar.
-- ═══════════════════════════════════════════════════════

-- ── 1. Tabla anti-replay para créditos TON verificados on-chain ──
CREATE TABLE IF NOT EXISTS public.ton_credits (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tx_hash         TEXT        NOT NULL UNIQUE,
  telegram_id     TEXT        NOT NULL,
  nanotons        TEXT        DEFAULT '0',
  tokens_credited BIGINT      DEFAULT 0,
  action          TEXT        DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.ton_credits ENABLE ROW LEVEL SECURITY;
-- Sin políticas para anon/authenticated: solo el service role (Worker) escribe/lee.

-- ── 2. El RPC de crédito NO puede ser llamado por clientes ──
-- (el Worker usa el service role, que no se ve afectado)
REVOKE EXECUTE ON FUNCTION public.add_duende_by_tgid(TEXT, BIGINT) FROM anon, authenticated;
-- Si la firma difiere, busca la real con: \df add_duende_by_tgid
-- y ajusta el REVOKE. Variante numeric:
-- REVOKE EXECUTE ON FUNCTION public.add_duende_by_tgid(TEXT, NUMERIC) FROM anon, authenticated;

-- ── 3. Tablas de dinero: solo lectura para clientes ──
-- Los INSERT pasan a hacerse exclusivamente desde el Worker (service role).
DROP POLICY IF EXISTS "stars_purchases_insert" ON public.stars_purchases;
DROP POLICY IF EXISTS "skin_purchases_insert"  ON public.skin_purchases;
DROP POLICY IF EXISTS "withdrawals_insert"     ON public.withdrawal_requests;
DROP POLICY IF EXISTS "ton_stakes_insert"      ON public.ton_stakes;

-- Lectura: cada quien puede consultar (necesario para mostrar skins/stakes propios).
-- Si quieres privacidad total entre usuarios, cambia USING (true) por un filtro por JWT.

-- ── 4. Anti-replay extra: tx únicos en compras ──
CREATE UNIQUE INDEX IF NOT EXISTS stars_purchases_txid_uniq
  ON public.stars_purchases (tx_id) WHERE tx_id <> '';
-- skin_purchases.tx_signature único (si la columna existe):
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='skin_purchases' AND column_name='tx_signature') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS skin_purchases_txsig_uniq
      ON public.skin_purchases (tx_signature) WHERE tx_signature IS NOT NULL AND tx_signature <> '';
  END IF;
END $$;

-- ── 5. Anti-cheat básico del leaderboard ──
-- Límites de cordura: nadie legítimo supera estos valores.
ALTER TABLE public.game_scores DROP CONSTRAINT IF EXISTS game_scores_sanity;
ALTER TABLE public.game_scores ADD CONSTRAINT game_scores_sanity
  CHECK (score >= 0 AND score <= 5000000 AND wave >= 1 AND wave <= 500);

-- ── 6. (Recomendado) revisar también: ──
-- · profiles: el cliente puede hacer UPDATE de telegram_id por username
--   (telegram/index.html linking) — riesgo de secuestro de perfil. Idealmente
--   mover el linking al Worker con initData verificado.
-- · donations / stakes (web): mismas observaciones que TON, verificar server-side.
