-- ═══════════════════════════════════════════════════════
-- DUENDE QUEST — Skin Purchases v2: add wallet + tx columns
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

ALTER TABLE public.skin_purchases ADD COLUMN IF NOT EXISTS wallet_address TEXT DEFAULT '';
ALTER TABLE public.skin_purchases ADD COLUMN IF NOT EXISTS tx_signature TEXT DEFAULT '';

-- Drop the unique constraint and recreate to allow both wallet and telegram purchases
ALTER TABLE public.skin_purchases DROP CONSTRAINT IF EXISTS skin_purchases_telegram_id_skin_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS skin_unique_owner ON public.skin_purchases (telegram_id, skin_id);
