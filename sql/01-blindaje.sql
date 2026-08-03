-- ═══════════════════════════════════════════════════════
-- DUENDE QUEST — BLINDAJE (escrito a partir del esquema REAL de producción)
--
-- CÓMO USARLO:
--   Supabase Dashboard → SQL Editor → New query → pega TODO → RUN
--   Es idempotente: puedes ejecutarlo varias veces sin romper nada.
--
-- QUÉ ARREGLA, en orden de gravedad:
--   1. CRÍTICO — hoy un usuario registrado puede ponerse el duende_balance
--      que quiera desde la consola del navegador. (Bloque 1)
--   2. El canje nunca funcionó: faltan las columnas y las funciones. (Bloque 4)
--   3. La creación de perfiles de Telegram falla siempre. (Bloque 2)
--   4. add_duende_by_tgid deja el saldo en negativo. (Bloque 3)
--   5. El torneo paga sobre scores que cualquiera puede inventar. (Bloque 5)
-- ═══════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════
-- BLOQUE 1 — CRÍTICO: cerrar la escritura de las columnas de dinero
-- ═══════════════════════════════════════════════════════
-- El agujero, verificado en el volcado del esquema:
--   · anon y authenticated tienen GRANT UPDATE a nivel de TABLA sobre profiles
--   · la política RLS profiles_update permite USING (auth.uid() = id)
--   · no hay WITH CHECK ni ningún trigger que proteja las columnas
-- Resultado: cualquiera que se registre en el juego web puede ejecutar
--   supabase.from('profiles').update({duende_balance: 999999999}).eq('id', <su id>)
-- y después pedir un retiro real con ton_sell. El único freno hoy eres tú
-- aprobando los retiros a mano.

-- 1.1 Quitar el UPDATE general y devolver solo las columnas inofensivas.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;

GRANT UPDATE (
  username, equipped_skin, is_premium, updated_at,
  wallet_ton, wallet_solana, wallet_address,
  dq_coins, dq_level, dq_xp, streak_day, streak_last
) ON public.profiles TO authenticated;

-- anon no necesita escribir NADA en profiles: todo lo suyo pasa por el Worker.

-- 1.2 Cinturón y tirantes: un trigger que rechaza el cambio aunque alguien
--     vuelva a otorgar permisos por error en el futuro.
--     current_user es 'anon'/'authenticated' en las llamadas directas de
--     PostgREST, 'postgres' dentro de las funciones SECURITY DEFINER y
--     'service_role' cuando escribe el Worker. Solo bloqueamos las primeras.
CREATE OR REPLACE FUNCTION public.guard_profile_money()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF NEW.duende_balance IS DISTINCT FROM OLD.duende_balance THEN
      RAISE EXCEPTION 'duende_balance solo lo modifica el servidor';
    END IF;
    IF NEW.telegram_id IS DISTINCT FROM OLD.telegram_id THEN
      RAISE EXCEPTION 'telegram_id solo lo modifica el servidor';
    END IF;
    IF NEW.dq_redeemable IS DISTINCT FROM OLD.dq_redeemable THEN
      RAISE EXCEPTION 'dq_redeemable solo lo modifica el servidor';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- El trigger se crea al final del script, cuando dq_redeemable ya existe.


-- ═══════════════════════════════════════════════════════
-- BLOQUE 2 — Desbloquear la creación de perfiles de Telegram
-- ═══════════════════════════════════════════════════════
-- Hoy profiles.id es NOT NULL sin DEFAULT y tiene FK a auth.users(id).
-- Consecuencia: el INSERT que hace el Worker en link_profile
-- (POST /profiles {telegram_id, username}) FALLA SIEMPRE, porque no manda id
-- y aunque lo mandara, un usuario de Telegram no existe en auth.users.
-- Por eso solo hay 1 fila en profiles.
--
-- Al quitar la FK se pierde el borrado en cascada cuando se elimina un usuario
-- de auth.users. Es reversible:
--   ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey
--     FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- El trigger handle_new_user sigue funcionando igual: inserta con el id de
-- auth.users explícitamente, así que el DEFAULT no le afecta.

-- create_tg_profile puede ser llamada hoy por cualquiera (anon=true) y crea
-- perfiles con el telegram_id que le pases: permite ocupar el telegram_id de
-- otra persona antes de que entre. Solo debe llamarla el Worker.
REVOKE EXECUTE ON FUNCTION public.create_tg_profile(text, text) FROM anon, authenticated, PUBLIC;


-- ═══════════════════════════════════════════════════════
-- BLOQUE 3 — add_duende_by_tgid: que no pueda dejar saldo negativo
-- ═══════════════════════════════════════════════════════
-- La versión actual hace duende_balance = duende_balance + p_amount sin más.
-- Con p_amount negativo (ton_sell) puede dejar el saldo bajo cero, y como el
-- Worker comprueba el saldo ANTES en una consulta aparte, dos retiros a la vez
-- pasan los dos. Aquí se corta por abajo y se fija el search_path.

CREATE OR REPLACE FUNCTION public.add_duende_by_tgid(p_tg_id text, p_amount bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.profiles
     SET duende_balance = GREATEST(0, COALESCE(duende_balance, 0) + p_amount),
         updated_at = NOW()
   WHERE telegram_id = p_tg_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.add_duende_by_tgid(text, bigint) FROM anon, authenticated, PUBLIC;

-- Gasto atómico de $DUENDE (para ton_sell). Descuenta solo si alcanza.
-- Devuelve el nuevo saldo, o -1 si no había suficiente. Sin doble gasto.
CREATE OR REPLACE FUNCTION public.spend_duende(p_tg_id text, p_amount bigint)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_new bigint;
BEGIN
  IF p_amount <= 0 THEN RETURN -1; END IF;

  UPDATE public.profiles
     SET duende_balance = duende_balance - p_amount,
         updated_at = NOW()
   WHERE telegram_id = p_tg_id
     AND COALESCE(duende_balance, 0) >= p_amount
  RETURNING duende_balance INTO v_new;

  IF NOT FOUND THEN RETURN -1; END IF;
  RETURN v_new;
END $$;

REVOKE EXECUTE ON FUNCTION public.spend_duende(text, bigint) FROM anon, authenticated, PUBLIC;

-- Red de seguridad a nivel de datos: el saldo nunca puede ser negativo.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_balance_no_negativo;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_balance_no_negativo
  CHECK (duende_balance IS NULL OR duende_balance >= 0);


-- ═══════════════════════════════════════════════════════
-- BLOQUE 4 — El canje: instalar lo que nunca se instaló
-- ═══════════════════════════════════════════════════════
-- El volcado confirma que sql/redeemable-balance.sql NUNCA se ejecutó:
-- no existen las columnas dq_redeemable / dq_earn_today / dq_earn_day, ni las
-- funciones accrue_dq / redeem_dq.
--
-- Efecto real hoy: en submit_score la llamada a rpc/accrue_dq devuelve 404,
-- se traga en el catch y siempre concede 0 DQ; y en request_redemption la
-- llamada a rpc/redeem_dq devuelve algo no numérico, así que el canje
-- responde siempre "saldo insuficiente". El canje nunca funcionó para nadie.
--
-- Nota: se instala el mecanismo, pero el canje sigue APAGADO por el
-- interruptor de functions/api/wallet.js hasta que decidas encenderlo.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dq_redeemable BIGINT  DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dq_earn_today INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dq_earn_day   TEXT    DEFAULT '';

-- NO migramos dq_coins → dq_redeemable. dq_coins lo manda el cliente y no es
-- de fiar; convertirlo en saldo canjeable sería regalar dinero.

-- Acreditar DQ canjeable con tope diario, en una sola transacción.
CREATE OR REPLACE FUNCTION public.accrue_dq(
  p_tg_id TEXT, p_amount INTEGER, p_day TEXT, p_daily_cap INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

-- Descontar DQ al canjear, atómico. Devuelve el nuevo saldo, o -1 si no alcanza.
CREATE OR REPLACE FUNCTION public.redeem_dq(p_tg_id TEXT, p_dq BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_new BIGINT;
BEGIN
  IF p_dq <= 0 THEN RETURN -1; END IF;

  UPDATE public.profiles
     SET dq_redeemable = dq_redeemable - p_dq
   WHERE telegram_id = p_tg_id AND COALESCE(dq_redeemable, 0) >= p_dq
  RETURNING dq_redeemable INTO v_new;

  IF NOT FOUND THEN RETURN -1; END IF;
  RETURN v_new;
END $$;

REVOKE EXECUTE ON FUNCTION public.accrue_dq(TEXT, INTEGER, TEXT, INTEGER) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_dq(TEXT, BIGINT)                 FROM anon, authenticated, PUBLIC;


-- ═══════════════════════════════════════════════════════
-- BLOQUE 5 — El torneo: que solo pueda premiar partidas reales
-- ═══════════════════════════════════════════════════════
-- La política scores_insert está abierta (WITH CHECK true, rol public) porque
-- el juego web inserta con la clave anon. No la cierro todavía: rompería el
-- ranking web hasta que ese envío pase por el Worker.
--
-- Lo que sí hago es marcar qué scores son de fiar. El Worker (service_role) no
-- se ve afectado por el trigger, así que sus inserts entran con verified=true;
-- cualquier insert desde el navegador entra con verified=false pase lo que pase.
-- Después hay que filtrar el torneo por verified = true (te dejo la consulta).

ALTER TABLE public.game_scores ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;

CREATE OR REPLACE FUNCTION public.mark_score_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    NEW.verified := false;      -- el cliente no puede autoproclamarse verificado
  ELSE
    NEW.verified := COALESCE(NEW.verified, true);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mark_score_verified ON public.game_scores;
CREATE TRIGGER trg_mark_score_verified
  BEFORE INSERT ON public.game_scores
  FOR EACH ROW EXECUTE FUNCTION public.mark_score_verified();

CREATE INDEX IF NOT EXISTS game_scores_verified_idx
  ON public.game_scores (verified, created_at DESC);

-- Los clientes solo deben poder INSERTAR y LEER scores, nunca modificarlos ni
-- borrarlos (hoy tienen UPDATE y DELETE concedidos a nivel de tabla).
REVOKE UPDATE, DELETE, TRUNCATE ON public.game_scores FROM anon, authenticated;


-- ═══════════════════════════════════════════════════════
-- BLOQUE 6 — Search path de los triggers heredados
-- ═══════════════════════════════════════════════════════
-- Las funciones SECURITY DEFINER sin search_path fijado son vulnerables a que
-- se les cuele un esquema falso por delante. Se arregla sin tocar su lógica.
ALTER FUNCTION public.handle_new_user()          SET search_path = public, pg_temp;
ALTER FUNCTION public.update_profile_on_score()  SET search_path = public, pg_temp;
ALTER FUNCTION public.create_tg_profile(text, text) SET search_path = public, pg_temp;


-- ═══════════════════════════════════════════════════════
-- BLOQUE 7 — Activar el guardián de las columnas de dinero
-- ═══════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS trg_guard_profile_money ON public.profiles;
CREATE TRIGGER trg_guard_profile_money
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_money();


-- ═══════════════════════════════════════════════════════
-- COMPROBACIÓN — debe devolver todo "OK"
-- ═══════════════════════════════════════════════════════
SELECT 'columnas del canje' AS control,
       CASE WHEN COUNT(*) = 3 THEN 'OK' ELSE 'FALTA' END AS estado
  FROM information_schema.columns
 WHERE table_name = 'profiles'
   AND column_name IN ('dq_redeemable', 'dq_earn_today', 'dq_earn_day')
UNION ALL
SELECT 'funciones de dinero',
       CASE WHEN COUNT(*) = 4 THEN 'OK' ELSE 'FALTA' END
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('accrue_dq', 'redeem_dq', 'spend_duende', 'add_duende_by_tgid')
UNION ALL
SELECT 'ningun cliente ejecuta RPC de dinero',
       CASE WHEN bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')
                      OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
            THEN 'FALLO' ELSE 'OK' END
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('accrue_dq', 'redeem_dq', 'spend_duende', 'add_duende_by_tgid', 'create_tg_profile')
UNION ALL
SELECT 'nadie puede escribir duende_balance',
       CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FALLO' END
  FROM information_schema.column_privileges
 WHERE table_name = 'profiles' AND column_name = 'duende_balance'
   AND privilege_type = 'UPDATE' AND grantee IN ('anon', 'authenticated')
UNION ALL
SELECT 'triggers de proteccion activos',
       CASE WHEN COUNT(*) = 2 THEN 'OK' ELSE 'FALTA' END
  FROM pg_trigger
 WHERE tgname IN ('trg_guard_profile_money', 'trg_mark_score_verified');
