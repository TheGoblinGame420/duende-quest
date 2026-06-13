-- ═══════════════════════════════════════════════════════
-- DUENDE QUEST — CANJE DQ → $DUENDE (manual semanal)
-- Ejecutar en Supabase SQL Editor (1 sola vez)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.redemptions (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id   TEXT        NOT NULL,
  username      TEXT        DEFAULT '',
  wallet_sol    TEXT        NOT NULL,
  dq_amount     BIGINT      NOT NULL,        -- DQ canjeados (descontados al pedir)
  duende_amount BIGINT      NOT NULL,        -- $DUENDE a enviar (1000 DQ = 1 $DUENDE)
  status        TEXT        DEFAULT 'pending', -- pending | paid | rejected
  tx_signature  TEXT        DEFAULT '',      -- firma del envío on-chain (al pagar)
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  paid_at       TIMESTAMPTZ
);
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;
-- Sin políticas para clientes: solo el Worker (service role) escribe/lee.
-- Los jugadores piden el canje a través de /api/wallet, nunca tocan la tabla directo.

CREATE INDEX IF NOT EXISTS redemptions_status_idx ON public.redemptions (status, created_at);
