-- ═══════════════════════════════════════════════════════
-- 06 · profiles deja de leerse entera con la clave pública (auditoría 24-oct-2026)
--
-- Hasta hoy, cualquiera con la clave anon (está en js/config.js, es pública)
-- podía descargar toda la tabla profiles: telegram_id, wallets y saldos de
-- todos los jugadores (el PASO B de 02-seguridad.sql nunca se aplicó).
--
-- Qué hace (idempotente, se puede ejecutar varias veces):
--  1) Borra las políticas SELECT de profiles y crea una sola: cada usuario
--     web ve SOLO su fila (auth-manager.js ya filtra por id = user.id).
--  2) anon no lee nada de profiles. El Worker usa la service role y no le afecta.
--  3) Función contar_jugadores() para el contador de la landing (index.html),
--     que devuelve solo el número, sin filas.
--
-- Cómo: Supabase → SQL Editor → pegar y ejecutar.
-- Comprobación: BEGIN; SET LOCAL ROLE anon; SELECT telegram_id FROM public.profiles LIMIT 1; ROLLBACK;
--               (debe dar ERROR de permisos)
-- ═══════════════════════════════════════════════════════

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', p.policyname);
  END LOOP;
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'ALL'
  LOOP
    RAISE WARNING 'profiles tiene la politica FOR ALL "%": tambien da SELECT; sustituyela a mano', p.policyname;
  END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_propio ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

REVOKE SELECT ON public.profiles FROM anon;

CREATE OR REPLACE FUNCTION public.contar_jugadores()
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ SELECT count(*) FROM public.profiles $$;
REVOKE ALL ON FUNCTION public.contar_jugadores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contar_jugadores() TO anon, authenticated;
