-- ═══════════════════════════════════════════════════════
-- DUENDE QUEST — TON Stakes table
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ton_stakes (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id     TEXT        NOT NULL,
  wallet_ton      TEXT        DEFAULT '',
  amount_ton      NUMERIC     DEFAULT 0,
  amount_usd      NUMERIC     DEFAULT 0,
  lock_days       INTEGER     DEFAULT 30,
  multiplier      NUMERIC     DEFAULT 1,
  apy             INTEGER     DEFAULT 120,
  reward_duende   BIGINT      DEFAULT 0,
  unlock_at       TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ton_stakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ton_stakes_select" ON public.ton_stakes
  FOR SELECT USING (true);

CREATE POLICY "ton_stakes_insert" ON public.ton_stakes
  FOR INSERT WITH CHECK (true);
