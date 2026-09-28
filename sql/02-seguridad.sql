-- ═══════════════════════════════════════════════════════════════════════
-- DUENDE QUEST — 02-seguridad.sql  (auditoría del 28-sep-2026)
--
-- Se ejecuta en Supabase → SQL Editor, en DOS PASOS:
--
--   PASO A (bloques A1-A4): se puede ejecutar YA. No rompe nada del cliente
--                           que está publicado hoy.
--   PASO B (bloque B1):     SOLO después de desplegar el código nuevo
--                           (git push). Cierra lecturas que la Mini App vieja
--                           todavía hace directamente contra Supabase.
--
-- Todo es idempotente: se puede ejecutar dos veces sin daño.
-- ═══════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════
-- PASO A
-- ═══════════════════════════════════════════════════════

-- ── A1. Los dos triggers "guardianes" no protegían nada ──
-- Dentro de una función SECURITY DEFINER, current_user es el DUEÑO de la
-- función (postgres), nunca 'anon' ni 'authenticated'. Así que la condición
-- IF current_user IN ('anon','authenticated') jamás se cumplía:
--   * mark_score_verified dejaba entrar verified = true desde el navegador,
--     y el torneo semanal (cron.js) paga 1000 $DUENDE a scores verificados.
--   * guard_profile_money nunca bloqueaba nada (hoy te protegen los GRANT
--     por columna de 01-blindaje, no este trigger).
-- Con SECURITY INVOKER, current_user es el rol real que hace la petición.
--
-- Ojo: esto NO bastaba para que el torneo pagara. verified tiene DEFAULT
-- false y Postgres aplica el default antes del trigger, así que el
-- COALESCE(NEW.verified, true) siempre daba false también para el Worker.
-- El Worker ahora envía verified: true de forma explícita (wallet.js).
ALTER FUNCTION public.mark_score_verified() SECURITY INVOKER;
ALTER FUNCTION public.guard_profile_money() SECURITY INVOKER;


-- ── A2. Insertar scores: solo usuarios logueados, solo a su nombre ──
-- Hoy anon puede insertar cualquier fila, con cualquier user_id. Como el
-- trigger update_profile_on_score actualiza el perfil de NEW.user_id, se podían
-- inflar las estadísticas de OTRO jugador. El juego web inserta como
-- 'authenticated' (js/auth-manager.js) y la Mini App pasa por el Worker, así
-- que anon no necesita INSERT.
REVOKE INSERT ON public.game_scores FROM anon, authenticated;
GRANT INSERT (user_id, username, score, wave, level, coins, bosses_killed, combos_max)
  ON public.game_scores TO authenticated;   -- ni verified ni telegram_id

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'game_scores' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.game_scores', p.policyname);
  END LOOP;
  -- Una politica FOR ALL tambien permite INSERT y se combina con OR con la
  -- nueva: la anularia. No la borro a ciegas (puede ser la que deja LEER el
  -- ranking); aviso para revisarla a mano.
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'game_scores' AND cmd = 'ALL'
  LOOP
    RAISE WARNING 'game_scores tiene la politica FOR ALL "%": sustituyela por una FOR SELECT, o el WITH CHECK de scores_insert_propio no sirve de nada', p.policyname;
  END LOOP;
END $$;

CREATE POLICY scores_insert_propio ON public.game_scores
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND score BETWEEN 0 AND 5000000 AND wave BETWEEN 1 AND 500);


-- ── A3. Referidos: una sola vez por usuario referido ──
-- El bot hacía SELECT y luego INSERT; dos /start simultáneos pagaban dos
-- veces. El índice único convierte el INSERT en el cerrojo (el bot ya solo
-- paga si su INSERT devuelve la fila). Primero se borran duplicados viejos.
DELETE FROM public.referrals a
  USING public.referrals b
  WHERE a.referred_tg_id = b.referred_tg_id AND a.ctid > b.ctid;   -- ctid: no depende de que exista columna id
CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_uniq
  ON public.referrals (referred_tg_id);


-- ── A4. Perfiles: nada de crear ni borrar desde el navegador ──
-- El guardián de dinero solo mira UPDATE. Si authenticated pudiera INSERTAR su
-- perfil, podría crearlo con duende_balance arbitrario. Los perfiles web los
-- crea el trigger handle_new_user y los de Telegram el Worker.
REVOKE INSERT, DELETE, TRUNCATE ON public.profiles FROM anon, authenticated;

-- link_telegram ya no la usa nadie (el bot la llamaba para vincular por
-- username, que era el secuestro de perfiles). Si existe, que nadie pueda
-- ejecutarla desde fuera.
-- Se busca por nombre y se usa la firma real: si fuera distinta de
-- (text, text), un REVOKE con la firma fija fallaria y desharia todo el script.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS f FROM pg_proc
           WHERE proname = 'link_telegram' AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, PUBLIC', r.f);
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════
-- PASO B — SOLO DESPUÉS DE DESPLEGAR EL CÓDIGO NUEVO
-- ═══════════════════════════════════════════════════════
-- Hoy cualquiera con la clave anon (que es pública) puede descargar el mapa
-- completo telegram_id ↔ wallets ↔ saldos ↔ retiros ↔ compras. La Mini App
-- nueva ya no lee estas tablas directamente (usa la acción my_data del
-- Worker), así que se pueden cerrar.
--
-- Descomenta y ejecuta cuando el despliegue esté hecho:

-- DROP POLICY IF EXISTS "withdrawals_select"     ON public.withdrawal_requests;
-- DROP POLICY IF EXISTS "stars_purchases_select" ON public.stars_purchases;
-- DROP POLICY IF EXISTS "skin_purchases_select"  ON public.skin_purchases;
-- DROP POLICY IF EXISTS "ton_stakes_select"      ON public.ton_stakes;
--
-- -- profiles: anon solo ve las columnas del ranking.
-- REVOKE SELECT ON public.profiles FROM anon;
-- GRANT SELECT (id, username, best_score, best_wave, games_played, equipped_skin)
--   ON public.profiles TO anon;


-- ═══════════════════════════════════════════════════════
-- COMPROBACIONES (ejecuta y mira el resultado)
-- ═══════════════════════════════════════════════════════
-- 1) Debe dar ERROR de permisos: anon ya no inserta scores.
--    BEGIN; SET LOCAL ROLE anon; INSERT INTO game_scores(username,score,wave) VALUES ('t',1,1); ROLLBACK;
--
-- 2) Las dos funciones deben salir con prosecdef = false.
SELECT proname, prosecdef FROM pg_proc
 WHERE proname IN ('mark_score_verified', 'guard_profile_money');
