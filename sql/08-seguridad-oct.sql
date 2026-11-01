-- ═══════════════════════════════════════════════════════════════════════
-- DUENDE QUEST — 08-seguridad-oct.sql  (auditoria del 31-oct-2026)
--
-- Ejecutar en Supabase → SQL Editor DESPUES de publicar el codigo nuevo
-- (git push). El Worker ya funciona sin este SQL (sigue como antes) y lo
-- empieza a usar en cuanto las columnas existen.
-- Todo es idempotente: se puede ejecutar mas de una vez.
-- ═══════════════════════════════════════════════════════════════════════


-- ── 1. Ultimo ticket de partida emitido (canje DQ de la web) ──
-- web_start_run guarda aqui la hora del ticket que acaba de firmar y
-- web_submit_score / accrue_dq_web solo aceptan ESE ticket. Antes se podian
-- pedir varios tickets de golpe y cobrarlos todos uno detras de otro.
-- No se anade al GRANT UPDATE de profiles: el usuario no puede tocarla.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dq_last_issued_ts BIGINT DEFAULT 0;


-- ── 2. Ticket de partida atomico en game_scores ──
-- El Worker inserta la fila con run_key ('tg:<id>:<ts>' o 'web:<uuid>:<ts>')
-- ANTES de acreditar DQ. Con el indice UNIQUE, de N envios en paralelo con el
-- mismo ticket solo uno consigue la fila; el resto recibe run_used.
-- Parcial (WHERE run_key IS NOT NULL) para no chocar con las filas viejas.
-- run_key no se anade al GRANT SELECT de 05-auditoria-oct.sql: no es publica.
ALTER TABLE public.game_scores ADD COLUMN IF NOT EXISTS run_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS game_scores_run_key_uniq
  ON public.game_scores (run_key) WHERE run_key IS NOT NULL;


-- ── 3. Se cierra el INSERT directo en game_scores desde el navegador ──
-- Las partidas de la web ya las inserta el Worker (web_submit_score, con
-- verified = true y el username de profiles). Con la politica
-- scores_insert_propio (02-seguridad.sql) cualquier cuenta web gratuita
-- insertaba score 5.000.000 con el nombre que quisiera y salia primera.
REVOKE INSERT ON public.game_scores FROM anon, authenticated;

DO $$
DECLARE p record;
BEGIN
  -- Borra todas las politicas de INSERT (scores_insert_propio y la vieja
  -- scores_insert si sigue ahi): el Worker usa service_role y no las necesita.
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'game_scores' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.game_scores', p.policyname);
  END LOOP;
END $$;


-- ── 4. accrue_dq_web solo acepta el ultimo ticket emitido ──
-- Igual que en 03-web-canje.sql, mas una comprobacion dentro del FOR UPDATE:
-- si hay un ticket emitido guardado (> 0) y no es este, no acredita nada.
-- Misma firma, asi que el REVOKE de 03-web-canje.sql sigue valiendo.
CREATE OR REPLACE FUNCTION public.accrue_dq_web(
  p_user_id UUID, p_amount INTEGER, p_day TEXT, p_daily_cap INTEGER, p_run_ts BIGINT
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_used    INTEGER;
  v_last    BIGINT;
  v_issued  BIGINT;
  v_granted INTEGER;
BEGIN
  IF p_amount <= 0 THEN RETURN 0; END IF;

  SELECT CASE WHEN dq_earn_day = p_day THEN COALESCE(dq_earn_today, 0) ELSE 0 END,
         COALESCE(dq_last_run_ts, 0),
         COALESCE(dq_last_issued_ts, 0)
    INTO v_used, v_last, v_issued
    FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN RETURN 0; END IF;
  -- ticket ya usado
  IF p_run_ts <= v_last THEN RETURN 0; END IF;
  -- ticket viejo: despues se emitio otro
  IF v_issued > 0 AND p_run_ts <> v_issued THEN RETURN 0; END IF;

  v_granted := LEAST(p_amount, GREATEST(0, p_daily_cap - v_used));

  UPDATE public.profiles
     SET dq_redeemable  = COALESCE(dq_redeemable, 0) + v_granted,
         dq_earn_today  = v_used + v_granted,
         dq_earn_day    = p_day,
         dq_last_run_ts = p_run_ts
   WHERE id = p_user_id;

  RETURN v_granted;
END $$;

-- Solo el Worker (service role) la llama.
REVOKE EXECUTE ON FUNCTION public.accrue_dq_web(UUID, INTEGER, TEXT, INTEGER, BIGINT) FROM anon, authenticated, PUBLIC;


-- ── 5. Que PostgREST vea ya las columnas nuevas ──
NOTIFY pgrst, 'reload schema';


-- ── COMPROBACIONES ──
-- 1) Debe devolver 0 filas: ninguna politica de INSERT en game_scores.
SELECT policyname, cmd FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'game_scores' AND cmd = 'INSERT';
-- 2) Debe devolver false dos veces: ni anon ni authenticated pueden insertar
--    (ni en la tabla ni en ninguna columna).
SELECT has_any_column_privilege('anon', 'public.game_scores', 'INSERT'),
       has_any_column_privilege('authenticated', 'public.game_scores', 'INSERT');
-- 3) Debe salir el indice game_scores_run_key_uniq.
SELECT indexname FROM pg_indexes WHERE tablename = 'game_scores' AND indexname = 'game_scores_run_key_uniq';
