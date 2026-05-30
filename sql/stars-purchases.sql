-- ═══════════════════════════════════════════════════════
-- DUENDE QUEST — Stars Purchases table
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.stars_purchases (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id     TEXT        NOT NULL,
  amount_usd      NUMERIC     DEFAULT 0,
  amount_stars    INTEGER     DEFAULT 0,
  tokens_credited BIGINT      DEFAULT 0,
  tx_id           TEXT        DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stars_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stars_purchases_select" ON public.stars_purchases
  FOR SELECT USING (true);

CREATE POLICY "stars_purchases_insert" ON public.stars_purchases
  FOR INSERT WITH CHECK (true);
