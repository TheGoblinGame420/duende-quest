-- ═══════════════════════════════════════════
-- DUENDE QUEST — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════

-- ── PROFILES TABLE ──────────────────────────
CREATE TABLE public.profiles (
  id              UUID        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username        TEXT        UNIQUE NOT NULL
                              CHECK (length(username) >= 3 AND length(username) <= 20),
  best_score      BIGINT      DEFAULT 0,
  best_wave       INTEGER     DEFAULT 0,
  total_coins     BIGINT      DEFAULT 0,
  games_played    INTEGER     DEFAULT 0,
  wallet_solana   TEXT,
  wallet_ton      TEXT,
  is_premium      BOOLEAN     DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── GAME SCORES TABLE ────────────────────────
CREATE TABLE public.game_scores (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
  username        TEXT        NOT NULL,
  score           BIGINT      NOT NULL,
  wave            INTEGER     NOT NULL,
  level           INTEGER     NOT NULL DEFAULT 1,
  coins           INTEGER     NOT NULL DEFAULT 0,
  bosses_killed   INTEGER     DEFAULT 0,
  combos_max      INTEGER     DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast leaderboard queries
CREATE INDEX idx_scores_score ON public.game_scores (score DESC);
CREATE INDEX idx_scores_created ON public.game_scores (created_at DESC);

-- ── ROW LEVEL SECURITY ───────────────────────
ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;

-- Profiles: everyone can read, only owner can write
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Scores: everyone can read, authenticated users can insert their own
CREATE POLICY "scores_select" ON public.game_scores
  FOR SELECT USING (true);

CREATE POLICY "scores_insert" ON public.game_scores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── TRIGGER: auto-create profile on signup ───
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  uname TEXT;
  tries INTEGER := 0;
BEGIN
  uname := COALESCE(
    new.raw_user_meta_data->>'username',
    'duende_' || substr(new.id::text, 1, 8)
  );
  -- Avoid username collision
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = uname) LOOP
    tries := tries + 1;
    uname := (new.raw_user_meta_data->>'username') || '_' || tries::text;
    IF tries > 20 THEN
      uname := 'duende_' || substr(new.id::text, 1, 8);
      EXIT;
    END IF;
  END LOOP;

  INSERT INTO public.profiles (id, username)
  VALUES (new.id, uname)
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ── TRIGGER: update profile stats on new score ──
CREATE OR REPLACE FUNCTION public.update_profile_on_score()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles SET
    best_score   = GREATEST(best_score,   NEW.score),
    best_wave    = GREATEST(best_wave,    NEW.wave),
    total_coins  = total_coins + NEW.coins,
    games_played = games_played + 1,
    updated_at   = NOW()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_score_inserted
  AFTER INSERT ON public.game_scores
  FOR EACH ROW EXECUTE PROCEDURE public.update_profile_on_score();

-- ═══════════════════════════════════════════
-- DONATION & TELEGRAM EXTENSIONS
-- ═══════════════════════════════════════════

-- ── NEW COLUMNS ON PROFILES ─────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wallet_address TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS duende_balance BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS telegram_id    TEXT UNIQUE;

-- ── DONATIONS TABLE ─────────────────────────
CREATE TABLE IF NOT EXISTS public.donations (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address  TEXT        NOT NULL,
  sol_amount      NUMERIC     NOT NULL,
  duende_earned   BIGINT      NOT NULL,
  tx_signature    TEXT        UNIQUE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "donations_select" ON public.donations
  FOR SELECT USING (true);

CREATE POLICY "donations_insert" ON public.donations
  FOR INSERT WITH CHECK (true);

-- ── RPC: add_duende_balance ─────────────────
CREATE OR REPLACE FUNCTION public.add_duende_balance(p_wallet TEXT, p_amount BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET duende_balance = duende_balance + p_amount,
      updated_at = NOW()
  WHERE wallet_address = p_wallet OR wallet_solana = p_wallet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════
-- STAKING TABLE & VIEW
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.stakes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address  TEXT NOT NULL,
  sol_amount      NUMERIC(18,9) NOT NULL,
  lock_days       INTEGER NOT NULL CHECK (lock_days IN (7, 30, 90)),
  apy_at_stake    NUMERIC(6,2) NOT NULL,
  duende_expected BIGINT NOT NULL,
  tx_signature    TEXT UNIQUE NOT NULL,
  staked_at       TIMESTAMPTZ DEFAULT NOW(),
  unlocks_at      TIMESTAMPTZ NOT NULL,
  claimed         BOOLEAN DEFAULT FALSE,
  claimed_at      TIMESTAMPTZ
);

ALTER TABLE public.stakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stakes_select" ON public.stakes FOR SELECT USING (true);
CREATE POLICY "stakes_insert" ON public.stakes FOR INSERT WITH CHECK (true);
CREATE POLICY "stakes_update" ON public.stakes FOR UPDATE USING (true);

-- Vista de stats para el FOMO ticker
CREATE OR REPLACE VIEW public.staking_stats AS
SELECT
  COUNT(*) as total_stakes,
  COALESCE(SUM(sol_amount), 0) as total_sol_staked,
  COALESCE(SUM(duende_expected), 0) as total_duende_locked,
  COUNT(CASE WHEN claimed = false THEN 1 END) as active_stakes
FROM public.stakes;

-- ═══════════════════════════════════════════
-- REFERRAL SYSTEM
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.referrals (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_tg_id    TEXT NOT NULL,
  referred_tg_id    TEXT UNIQUE NOT NULL,
  referred_username TEXT,
  bonus_paid        BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals (referrer_tg_id);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_select" ON public.referrals FOR SELECT USING (true);
CREATE POLICY "referrals_insert" ON public.referrals FOR INSERT WITH CHECK (true);

-- ── RPC: add_duende_by_tgid ────────────────
CREATE OR REPLACE FUNCTION public.add_duende_by_tgid(p_tg_id TEXT, p_amount BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET duende_balance = duende_balance + p_amount,
      updated_at = NOW()
  WHERE telegram_id = p_tg_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
