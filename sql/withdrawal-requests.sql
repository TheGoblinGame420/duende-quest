-- ═══════════════════════════════════════════════════════
-- DUENDE QUEST — Withdrawal Requests table
-- Run this in Supabase SQL Editor
-- Users sell $DUENDE → request TON withdrawal
-- Admin processes manually: sends TON, marks as 'completed'
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id     TEXT        NOT NULL,
  wallet_ton      TEXT        NOT NULL,
  tokens_burned   BIGINT      DEFAULT 0,
  ton_amount      NUMERIC     DEFAULT 0,
  usd_value       NUMERIC     DEFAULT 0,
  status          TEXT        DEFAULT 'pending',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "withdrawals_select" ON public.withdrawal_requests
  FOR SELECT USING (true);

CREATE POLICY "withdrawals_insert" ON public.withdrawal_requests
  FOR INSERT WITH CHECK (true);

-- To process withdrawals, run in SQL Editor:
-- UPDATE withdrawal_requests SET status = 'completed', processed_at = NOW() WHERE id = '<uuid>';
