-- ═══════════════════════════════════════════════════════
-- DUENDE QUEST — Skin Purchases table
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.skin_purchases (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id     TEXT        NOT NULL,
  skin_id         TEXT        NOT NULL,
  payment_type    TEXT        DEFAULT 'stars',
  amount_paid     NUMERIC     DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(telegram_id, skin_id)
);

ALTER TABLE public.skin_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skin_purchases_select" ON public.skin_purchases
  FOR SELECT USING (true);

CREATE POLICY "skin_purchases_insert" ON public.skin_purchases
  FOR INSERT WITH CHECK (true);

-- Add equipped_skin column to profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS equipped_skin TEXT DEFAULT 'comun';
