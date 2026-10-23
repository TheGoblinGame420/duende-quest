-- ═══════════════════════════════════════════════════════
-- Auditoría de seguridad del 22-oct-2026 — ejecutar en Supabase → SQL Editor
--
-- Ejecutar DESPUÉS de publicar el código nuevo (git push): la Mini App ya no
-- lee telegram_id del ranking, así que quitar esas columnas no rompe nada.
-- Todo es idempotente: se puede ejecutar más de una vez.
-- ═══════════════════════════════════════════════════════

-- 1) ALTA — Las tablas de dinero seguían legibles por cualquiera con la clave
--    pública (era el "PASO B" comentado de 02-seguridad.sql). Hoy están
--    vacías; con la primera compra/retiro real se vería telegram_id ↔ wallet
--    ↔ importes. El cliente ya lee "lo suyo" a través del Worker (my_data).
DROP POLICY IF EXISTS "stars_purchases_select" ON public.stars_purchases;
DROP POLICY IF EXISTS "skin_purchases_select"  ON public.skin_purchases;
DROP POLICY IF EXISTS "withdrawals_select"     ON public.withdrawal_requests;
DROP POLICY IF EXISTS "ton_stakes_select"      ON public.ton_stakes;

-- 2) MEDIA — game_scores y tournament_awards exponían telegram_id y user_id
--    a cualquiera. Solo quedan legibles las columnas del ranking.
REVOKE SELECT ON public.game_scores FROM anon, authenticated;
GRANT  SELECT (id, username, score, wave, level, coins, bosses_killed, combos_max, created_at, verified)
  ON public.game_scores TO anon, authenticated;

REVOKE SELECT ON public.tournament_awards FROM anon, authenticated;
GRANT  SELECT (id, week_key, position, username, score, prize_duende, created_at)
  ON public.tournament_awards TO anon, authenticated;

-- 3) BAJA — Un usuario web podía ponerse is_premium o equipped_skin desde la
--    consola sin comprar. Se quitan del UPDATE permitido (el resto igual que
--    en 01-blindaje.sql). OJO: si en 01-blindaje.sql tienes columnas extra en
--    el GRANT, añádelas aquí antes de ejecutar.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT  UPDATE (username, updated_at, wallet_ton, wallet_solana, wallet_address,
               dq_coins, dq_level, dq_xp, streak_day, streak_last)
  ON public.profiles TO authenticated;

-- Comprobación: debe devolver 0 filas con cmd = 'SELECT' para las 4 tablas de dinero.
SELECT tablename, policyname, cmd FROM pg_policies
WHERE tablename IN ('stars_purchases','skin_purchases','withdrawal_requests','ton_stakes');
