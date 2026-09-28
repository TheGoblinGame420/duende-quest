-- ═══════════════════════════════════════════════════════════════════════
-- DUENDE QUEST — 03-web-canje.sql  (28-sep-2026)
--
-- Reconstruye en la web lo que se quitó de la Mini App de Telegram por
-- cumplimiento (comprar/cambiar/canjear $DUENDE dentro de una Mini App con
-- un token que no es de TON). En la web SÍ se puede:
--
--   1. Comprar SKINS con SOL, ahora con el patrón "reference" de Solana Pay
--      (antes cualquiera podía copiar de la cadena el pago de otra persona
--      y reclamar la skin — ver functions/api/helius-verify.js).
--   2. Canjear el DQ que se gana JUGANDO por $DUENDE real a una wallet de
--      Solana (igual que ya existía en Telegram, pero por cuenta de la web
--      — Supabase Auth — en vez de por telegram_id). Esto es un PAGO DE
--      RECOMPENSA por jugar, no una compra ni un canje de fondos que el
--      usuario deposita: el usuario nunca entrega dinero aquí, así que no
--      dispara los mismos supuestos de PSAV que un exchange (ver
--      ESTRATEGIA-TOKEN.md). Por eso esto sí se construye y el swap
--      TON/SOL↔$DUENDE con saldo interno canjeable NO (se dejó apagado,
--      ver SWITCHES en functions/api/wallet.js).
--
-- Ejecutar completo en Supabase → SQL Editor. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════


-- ── 1. Órdenes de pago SOL con referencia (Solana Pay) ──
CREATE TABLE IF NOT EXISTS public.sol_orders (
  reference         TEXT        PRIMARY KEY,
  kind              TEXT        NOT NULL DEFAULT 'skin',
  skin_id           TEXT,
  expected_lamports BIGINT      NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending',  -- pending | filled
  wallet_address    TEXT        DEFAULT '',
  tx_signature      TEXT        DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  filled_at         TIMESTAMPTZ
);
ALTER TABLE public.sol_orders ENABLE ROW LEVEL SECURITY;
-- Sin políticas para clientes: solo el Worker (service role) lo toca. El
-- cliente nunca lee ni escribe esta tabla directo, solo recibe la
-- referencia como respuesta de create_sol_order.
CREATE INDEX IF NOT EXISTS sol_orders_status_idx ON public.sol_orders (status, created_at);


-- ── 2. Canje DQ → $DUENDE para cuentas web (por id de Supabase Auth) ──
-- Las columnas ya existen (dq_redeemable, dq_earn_today, dq_earn_day —
-- sql/01-blindaje.sql / redeemable-balance.sql): se reutilizan tal cual,
-- solo se filtra por `id` (uuid de auth.users) en vez de `telegram_id`.

-- p_run_ts: el timestamp (ms) que firmó el ticket de la partida. Un mismo
-- ticket solo se puede canjear una vez (equivalente al "run_used" que en la
-- version de Telegram se comprueba mirando el último game_scores insertado
-- — la web no inserta ahí desde este flujo, así que aquí se guarda su propio
-- puntero, dq_last_run_ts, y se exige que cada partida sea más nueva que la
-- anterior. Sin esto, un solo ticket valido se podia reenviar en bucle hasta
-- agotar el tope diario de un tiron.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dq_last_run_ts BIGINT DEFAULT 0;

CREATE OR REPLACE FUNCTION public.accrue_dq_web(
  p_user_id UUID, p_amount INTEGER, p_day TEXT, p_daily_cap INTEGER, p_run_ts BIGINT
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_used    INTEGER;
  v_last    BIGINT;
  v_granted INTEGER;
BEGIN
  IF p_amount <= 0 THEN RETURN 0; END IF;

  SELECT CASE WHEN dq_earn_day = p_day THEN COALESCE(dq_earn_today, 0) ELSE 0 END,
         COALESCE(dq_last_run_ts, 0)
    INTO v_used, v_last
    FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN RETURN 0; END IF;
  IF p_run_ts <= v_last THEN RETURN 0; END IF;   -- ticket ya usado

  v_granted := LEAST(p_amount, GREATEST(0, p_daily_cap - v_used));

  UPDATE public.profiles
     SET dq_redeemable  = COALESCE(dq_redeemable, 0) + v_granted,
         dq_earn_today  = v_used + v_granted,
         dq_earn_day    = p_day,
         dq_last_run_ts = p_run_ts
   WHERE id = p_user_id;

  RETURN v_granted;
END $$;

CREATE OR REPLACE FUNCTION public.redeem_dq_web(p_user_id UUID, p_dq BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_new BIGINT;
BEGIN
  UPDATE public.profiles
     SET dq_redeemable = dq_redeemable - p_dq
   WHERE id = p_user_id AND COALESCE(dq_redeemable, 0) >= p_dq
  RETURNING dq_redeemable INTO v_new;

  IF NOT FOUND THEN RETURN -1; END IF;
  RETURN v_new;
END $$;

-- Solo el Worker (service role) los llama.
REVOKE EXECUTE ON FUNCTION public.accrue_dq_web(UUID, INTEGER, TEXT, INTEGER, BIGINT) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_dq_web(UUID, BIGINT)                 FROM anon, authenticated, PUBLIC;


-- ── 3. La tabla `redemptions` pasa a admitir cuentas web además de Telegram ──
ALTER TABLE public.redemptions ALTER COLUMN telegram_id DROP NOT NULL;
ALTER TABLE public.redemptions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.redemptions DROP CONSTRAINT IF EXISTS redemptions_identidad_check;
ALTER TABLE public.redemptions ADD CONSTRAINT redemptions_identidad_check
  CHECK (telegram_id IS NOT NULL OR user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS redemptions_user_idx ON public.redemptions (user_id);


-- ── COMPROBACIONES ──
-- 1) Debe dar ERROR de permisos: nadie externo llama a estas funciones.
--    BEGIN; SET LOCAL ROLE authenticated; SELECT accrue_dq_web('00000000-0000-0000-0000-000000000000',1,'2026-01-01',100,1); ROLLBACK;
--
-- 2) prosecdef debe salir true (SECURITY DEFINER, a propósito: necesitan
--    escribir dq_redeemable, que el propio usuario no puede tocar).
SELECT proname, prosecdef FROM pg_proc
 WHERE proname IN ('accrue_dq_web', 'redeem_dq_web');
