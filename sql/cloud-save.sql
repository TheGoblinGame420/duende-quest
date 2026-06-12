-- ═══════════════════════════════════════════════════════
-- DUENDE QUEST — CLOUD SAVE
-- Ejecutar en Supabase SQL Editor (1 sola vez)
-- El progreso DQ del jugador deja de vivir solo en su teléfono.
-- ═══════════════════════════════════════════════════════

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dq_coins   BIGINT  DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dq_level   INTEGER DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dq_xp      INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_day INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_last TEXT   DEFAULT '';
