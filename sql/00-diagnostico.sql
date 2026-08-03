-- ═══════════════════════════════════════════════════════
-- DUENDE QUEST — DIAGNÓSTICO DE LA BASE DE DATOS
--
-- CÓMO USARLO (no rompe nada, solo lee):
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Pega TODO este archivo y pulsa RUN
--   3. Abajo aparece una tabla con una columna "linea"
--   4. Pulsa "Download CSV" y pásame el archivo
--
-- Esto es 100% de solo lectura: no crea, no borra, no modifica nada.
-- Con el resultado puedo escribirte el SQL de blindaje exacto para TU
-- base de datos, en vez de adivinar.
-- ═══════════════════════════════════════════════════════

WITH
-- ── 1. Tablas y columnas ──
cols AS (
  SELECT 1 AS orden, c.table_name AS grupo,
         format('COLUMNA | %s.%s | tipo=%s | nulo=%s | default=%s',
                c.table_name, c.column_name, c.data_type,
                c.is_nullable, coalesce(c.column_default, '-')) AS linea
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
),

-- ── 2. Constraints (PK, UNIQUE, CHECK, FK) ──
cons AS (
  SELECT 2, rel.relname,
         format('CONSTRAINT | %s | tabla=%s | %s',
                con.conname, rel.relname, pg_get_constraintdef(con.oid))
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  WHERE n.nspname = 'public'
),

-- ── 3. Índices ──
idx AS (
  SELECT 3, tablename, format('INDICE | %s', indexdef)
  FROM pg_indexes WHERE schemaname = 'public'
),

-- ── 4. RLS activado o no, por tabla ──
rls AS (
  SELECT 4, c.relname,
         format('RLS | tabla=%s | habilitado=%s', c.relname, c.relrowsecurity)
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
),

-- ── 5. Políticas RLS (quién puede leer/escribir qué) ──
pol AS (
  SELECT 5, tablename,
         format('POLICY | %s | tabla=%s | cmd=%s | roles=%s | using=%s | check=%s',
                policyname, tablename, cmd, roles::text,
                coalesce(qual, '-'), coalesce(with_check, '-'))
  FROM pg_policies WHERE schemaname = 'public'
),

-- ── 6. Permisos de TABLA para anon/authenticated ──
-- (clave: si aquí sale UPDATE sobre profiles, el REVOKE por columnas no protege)
grants_tabla AS (
  SELECT 6, table_name,
         format('GRANT-TABLA | tabla=%s | rol=%s | privilegio=%s',
                table_name, grantee, privilege_type)
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated', 'public')
),

-- ── 7. Permisos de COLUMNA sobre las columnas de dinero ──
grants_col AS (
  SELECT 7, table_name,
         format('GRANT-COLUMNA | tabla=%s | columna=%s | rol=%s | privilegio=%s',
                table_name, column_name, grantee, privilege_type)
  FROM information_schema.column_privileges
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'authenticated', 'public')
    AND column_name IN ('duende_balance', 'dq_redeemable', 'dq_earn_today',
                        'dq_earn_day', 'dq_coins', 'telegram_id', 'username')
),

-- ── 8. Funciones (el código real de add_duende_by_tgid, link_telegram, etc.) ──
funcs AS (
  SELECT 8, p.proname,
         format('FUNCION | %s(%s) | security=%s | search_path=%s%s--- CODIGO ---%s%s',
                p.proname,
                pg_get_function_identity_arguments(p.oid),
                CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END,
                coalesce(array_to_string(p.proconfig, ','), 'NO FIJADO'),
                chr(10), chr(10),
                pg_get_functiondef(p.oid))
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f'
),

-- ── 9. Quién puede EJECUTAR cada función ──
funcs_grants AS (
  SELECT 9, p.proname,
         format('FUNCION-PERMISO | %s(%s) | anon=%s | authenticated=%s',
                p.proname,
                pg_get_function_identity_arguments(p.oid),
                has_function_privilege('anon', p.oid, 'EXECUTE'),
                has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f'
),

-- ── 10. Cuántas filas hay en cada tabla (estimado, sin escanear) ──
filas AS (
  SELECT 10, c.relname,
         format('FILAS-APROX | tabla=%s | ~%s filas',
                c.relname, greatest(c.reltuples::bigint, 0))
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
),

todo AS (
  SELECT * FROM cols
  UNION ALL SELECT * FROM cons
  UNION ALL SELECT * FROM idx
  UNION ALL SELECT * FROM rls
  UNION ALL SELECT * FROM pol
  UNION ALL SELECT * FROM grants_tabla
  UNION ALL SELECT * FROM grants_col
  UNION ALL SELECT * FROM funcs
  UNION ALL SELECT * FROM funcs_grants
  UNION ALL SELECT * FROM filas
)

SELECT linea
FROM todo
ORDER BY orden, grupo, linea;
