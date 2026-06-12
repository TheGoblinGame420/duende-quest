-- ═══════════════════════════════════════════════════════
-- DUENDE QUEST — RETENTION FEATURES
-- Ejecutar en Supabase SQL Editor (después de security-hardening.sql)
-- Soporta: torneo semanal automático + scores firmados
-- ═══════════════════════════════════════════════════════

-- ── 1. Premios del torneo semanal (anti doble pago por week_key) ──
CREATE TABLE IF NOT EXISTS public.tournament_awards (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  week_key      TEXT        NOT NULL,
  position      INTEGER     NOT NULL,
  username      TEXT        DEFAULT '',
  score         BIGINT      DEFAULT 0,
  prize_duende  BIGINT      DEFAULT 0,
  telegram_id   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (week_key, position)
);
ALTER TABLE public.tournament_awards ENABLE ROW LEVEL SECURITY;
-- Lectura pública (para mostrar ganadores); escritura solo service role (Worker)
CREATE POLICY "tournament_awards_select" ON public.tournament_awards
  FOR SELECT USING (true);

-- ── 2. game_scores: columna telegram_id para scores firmados ──
ALTER TABLE public.game_scores ADD COLUMN IF NOT EXISTS telegram_id TEXT;

-- ── 3. (Opcional, recomendado cuando haya premios reales) ──
-- Cerrar el INSERT directo de scores desde clientes; el Worker (service role)
-- inserta los scores verificados con initData. ⚠️ El juego WEB aún envía
-- scores con la clave anon — ejecuta esto solo cuando el web también use
-- un endpoint firmado, o el ranking web dejará de registrar:
-- DROP POLICY IF EXISTS "game_scores_insert" ON public.game_scores;
