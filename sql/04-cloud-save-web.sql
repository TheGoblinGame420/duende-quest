-- ═══════════════════════════════════════════════════════════════════════
-- DUENDE QUEST — 04-cloud-save-web.sql  (28-sep-2026)
--
-- El progreso del jugador (monedas del cofre, nivel/XP, racha y ahora las
-- estrellas de campaña) vivía SOLO en localStorage del navegador: si el
-- jugador cambiaba de teléfono, borraba datos del sitio o reinstalaba,
-- perdía todo. Para Telegram ya existía un "cloud save" (sql/cloud-save.sql
-- + accion sync_progress) que sube ese progreso a su perfil y lo recupera
-- al entrar en otro dispositivo — pero (a) nunca incluía las estrellas de
-- campaña y (b) la web nunca lo tuvo, solo Telegram.
--
-- Este archivo:
--   1. Vuelve a declarar las columnas de sql/cloud-save.sql (IF NOT EXISTS,
--      por si esa migración nunca llegó a ejecutarse — sync_progress lleva
--      tiempo en el código pero sin estas columnas cada llamada fallaba
--      en silencio, el .catch(()=>{}) del cliente se comía el error).
--   2. Añade campaign_stars (estrellas por etapa, id de etapa -> 0-3).
--
-- Ejecutar completo en Supabase → SQL Editor. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dq_coins        BIGINT  DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dq_level        INTEGER DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dq_xp           INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_day      INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_last     TEXT    DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS campaign_stars  JSONB   DEFAULT '{}'::jsonb;

-- ── COMPROBACIÓN ──
-- Deben salir las 6 columnas de arriba.
SELECT column_name, data_type, column_default
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='profiles'
   AND column_name IN ('dq_coins','dq_level','dq_xp','streak_day','streak_last','campaign_stars');
