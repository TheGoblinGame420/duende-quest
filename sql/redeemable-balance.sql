-- ═══════════════════════════════════════════════════════
-- DUENDE QUEST — SALDO CANJEABLE SERVER-SIDE
-- Ejecutar en Supabase SQL Editor (1 sola vez)
--
-- Separa dos saldos que antes eran el mismo:
--   · dq_coins      → progreso del juego (cloud save). Lo manda el cliente.
--                     Es cosmético: sirve para no perder progreso al cambiar
--                     de teléfono. NUNCA se paga dinero con él.
--   · dq_redeemable → DQ canjeable por $DUENDE. Solo lo incrementa el Worker
--                     al recibir una partida (submit_score), con tope por
--                     partida y por día. Es el único que toca el canje.
-- ═══════════════════════════════════════════════════════

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dq_redeemable BIGINT  DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dq_earn_today INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dq_earn_day   TEXT    DEFAULT '';

-- Migración de saldos existentes: los jugadores que ya tenían DQ en la nube
-- arrancan con ese saldo como canjeable (todavía no hay abusos conocidos).
-- Si prefieres arrancar de cero, comenta esta línea.
UPDATE public.profiles SET dq_redeemable = COALESCE(dq_coins, 0)
 WHERE dq_redeemable = 0 AND COALESCE(dq_coins, 0) > 0;

-- ── Ningún cliente puede escribir las columnas de dinero ──
-- (el Worker usa el service role, que no se ve afectado)
REVOKE UPDATE (dq_redeemable, dq_earn_today, dq_earn_day)
    ON public.profiles FROM anon, authenticated;

-- ── Acreditar DQ canjeable con tope diario, en una sola transacción ──
-- Devuelve cuánto se acreditó realmente (0 si ya llegó al tope de hoy).
CREATE OR REPLACE FUNCTION public.accrue_dq(
  p_tg_id TEXT, p_amount INTEGER, p_day TEXT, p_daily_cap INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_used    INTEGER;
  v_granted INTEGER;
BEGIN
  IF p_amount <= 0 THEN RETURN 0; END IF;

  SELECT CASE WHEN dq_earn_day = p_day THEN COALESCE(dq_earn_today, 0) ELSE 0 END
    INTO v_used
    FROM public.profiles WHERE telegram_id = p_tg_id FOR UPDATE;

  IF NOT FOUND THEN RETURN 0; END IF;

  v_granted := LEAST(p_amount, GREATEST(0, p_daily_cap - v_used));
  IF v_granted = 0 THEN RETURN 0; END IF;

  UPDATE public.profiles
     SET dq_redeemable = COALESCE(dq_redeemable, 0) + v_granted,
         dq_earn_today = v_used + v_granted,
         dq_earn_day   = p_day
   WHERE telegram_id = p_tg_id;

  RETURN v_granted;
END $$;

-- ── Descontar DQ al canjear, atómico (sin doble gasto por peticiones a la vez) ──
-- Devuelve el nuevo saldo, o -1 si no alcanzaba.
CREATE OR REPLACE FUNCTION public.redeem_dq(p_tg_id TEXT, p_dq BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_new BIGINT;
BEGIN
  UPDATE public.profiles
     SET dq_redeemable = dq_redeemable - p_dq
   WHERE telegram_id = p_tg_id AND COALESCE(dq_redeemable, 0) >= p_dq
  RETURNING dq_redeemable INTO v_new;

  IF NOT FOUND THEN RETURN -1; END IF;
  RETURN v_new;
END $$;

-- Los RPC de dinero solo los llama el Worker
REVOKE EXECUTE ON FUNCTION public.accrue_dq(TEXT, INTEGER, TEXT, INTEGER) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_dq(TEXT, BIGINT)                 FROM anon, authenticated;
