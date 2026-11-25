-- Junior moves into the Kitchen Compass database (2026-11-25).
--
-- Junior is a sourdough starter tracker (junior.jessicafoxdesign.com). It used
-- to share Garden Life's database; it now lives beside Kitchen Compass and
-- uses the same Google sign-in and household list (public.allowed_emails,
-- checked by public.is_allowed()). Everything it owns is named sourdough_*.
--
--   sourdough_starters, _feedings, _readings, _levains, _bakes
--   sourdough_owner_matches()      a row must belong to a starter of the same user
--   sourdough_bake_levain_matches() a bake's levain must be the same user's
--   bucket sourdough-photos        private, one folder per user
--   ai_usage, ai_limits, claim_ai_use(), refund_ai_use()   daily cap on AI calls
--
-- Each person's starter stays private to them, even inside the household:
-- every policy needs both "on the household list" and "this row is mine".
-- Raw input is kept: what the AI read (ai_*) sits next to what the owner
-- confirmed and is never overwritten by it.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TABLE public.sourdough_starters (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  notes         text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  hydration_pct numeric NOT NULL DEFAULT 100 CHECK (hydration_pct BETWEEN 25 AND 300),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sourdough_starters_user_idx ON public.sourdough_starters (user_id);

CREATE TABLE public.sourdough_feedings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starter_id     uuid NOT NULL REFERENCES public.sourdough_starters(id) ON DELETE CASCADE,
  fed_at         timestamptz NOT NULL DEFAULT now(),
  kept_g         numeric CHECK (kept_g IS NULL OR kept_g >= 0),
  flour_g        numeric CHECK (flour_g IS NULL OR flour_g >= 0),
  flour_type     text CHECK (flour_type IS NULL OR char_length(flour_type) <= 100),
  water_g        numeric CHECK (water_g IS NULL OR water_g >= 0),
  room_temp_f    numeric CHECK (room_temp_f IS NULL OR room_temp_f BETWEEN 0 AND 130),
  start_level_in numeric CHECK (start_level_in IS NULL OR start_level_in BETWEEN 0 AND 24),
  note           text CHECK (note IS NULL OR char_length(note) <= 2000),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sourdough_feedings_starter_idx ON public.sourdough_feedings (starter_id, fed_at DESC);
CREATE INDEX sourdough_feedings_user_idx ON public.sourdough_feedings (user_id);

CREATE TABLE public.sourdough_readings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starter_id    uuid NOT NULL REFERENCES public.sourdough_starters(id) ON DELETE CASCADE,
  taken_at      timestamptz NOT NULL DEFAULT now(),
  level_in      numeric NOT NULL CHECK (level_in BETWEEN 0 AND 24),
  streak_in     numeric CHECK (streak_in IS NULL OR streak_in BETWEEN 0 AND 24),
  source        text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai')),
  ai_level_in   numeric,
  ai_streak_in  numeric,
  ai_model      text,
  ai_note       text CHECK (ai_note IS NULL OR char_length(ai_note) <= 1000),
  photo_path    text CHECK (photo_path IS NULL OR char_length(photo_path) <= 300),
  note          text CHECK (note IS NULL OR char_length(note) <= 2000),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sourdough_readings_starter_idx ON public.sourdough_readings (starter_id, taken_at DESC);
CREATE INDEX sourdough_readings_user_idx ON public.sourdough_readings (user_id);

CREATE TABLE public.sourdough_levains (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starter_id         uuid NOT NULL REFERENCES public.sourdough_starters(id) ON DELETE CASCADE,
  built_at           timestamptz NOT NULL DEFAULT now(),
  seed_g             numeric NOT NULL CHECK (seed_g > 0 AND seed_g <= 5000),
  feed_flour_g       numeric NOT NULL CHECK (feed_flour_g >= 0 AND feed_flour_g <= 20000),
  feed_water_g       numeric NOT NULL CHECK (feed_water_g >= 0 AND feed_water_g <= 20000),
  seed_hydration_pct numeric NOT NULL DEFAULT 100 CHECK (seed_hydration_pct BETWEEN 25 AND 300),
  ratio_label        text CHECK (ratio_label IS NULL OR char_length(ratio_label) <= 20),
  note               text CHECK (note IS NULL OR char_length(note) <= 2000),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sourdough_levains_starter_idx ON public.sourdough_levains (starter_id, built_at DESC);
CREATE INDEX sourdough_levains_user_idx ON public.sourdough_levains (user_id);

CREATE TABLE public.sourdough_bakes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starter_id         uuid NOT NULL REFERENCES public.sourdough_starters(id) ON DELETE CASCADE,
  levain_id          uuid REFERENCES public.sourdough_levains(id) ON DELETE SET NULL,
  mixed_at           timestamptz NOT NULL DEFAULT now(),
  target_mode        text NOT NULL CHECK (target_mode IN ('flour', 'loaves')),
  target_flour_g     numeric CHECK (target_flour_g IS NULL OR target_flour_g > 0),
  loaves             integer CHECK (loaves IS NULL OR loaves BETWEEN 1 AND 50),
  loaf_g             numeric CHECK (loaf_g IS NULL OR loaf_g > 0),
  hydration_pct      numeric NOT NULL CHECK (hydration_pct BETWEEN 40 AND 120),
  salt_pct           numeric NOT NULL CHECK (salt_pct BETWEEN 0 AND 5),
  second_flour       text CHECK (second_flour IS NULL OR char_length(second_flour) <= 60),
  second_flour_pct   numeric NOT NULL DEFAULT 0 CHECK (second_flour_pct BETWEEN 0 AND 100),
  levain_used_g      numeric NOT NULL CHECK (levain_used_g >= 0),
  total_flour_g      numeric NOT NULL,
  flour_add_g        numeric NOT NULL,
  second_flour_add_g numeric NOT NULL DEFAULT 0,
  water_add_g        numeric NOT NULL,
  salt_g             numeric NOT NULL,
  dough_g            numeric NOT NULL,
  note               text CHECK (note IS NULL OR char_length(note) <= 4000),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sourdough_bakes_starter_idx ON public.sourdough_bakes (starter_id, mixed_at DESC);
CREATE INDEX sourdough_bakes_user_idx ON public.sourdough_bakes (user_id);
CREATE INDEX sourdough_bakes_levain_idx ON public.sourdough_bakes (levain_id);

-- A row must belong to a starter of the same user.
CREATE FUNCTION public.sourdough_owner_matches()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sourdough_starters s WHERE s.id = NEW.starter_id AND s.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Starter not found';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.sourdough_owner_matches() FROM PUBLIC, anon, authenticated;

-- A bake's levain must be the same user's.
CREATE FUNCTION public.sourdough_bake_levain_matches()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.levain_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sourdough_levains l WHERE l.id = NEW.levain_id AND l.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Levain not found';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.sourdough_bake_levain_matches() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER sourdough_feedings_owner BEFORE INSERT OR UPDATE ON public.sourdough_feedings
  FOR EACH ROW EXECUTE FUNCTION public.sourdough_owner_matches();
CREATE TRIGGER sourdough_readings_owner BEFORE INSERT OR UPDATE ON public.sourdough_readings
  FOR EACH ROW EXECUTE FUNCTION public.sourdough_owner_matches();
CREATE TRIGGER sourdough_levains_owner BEFORE INSERT OR UPDATE ON public.sourdough_levains
  FOR EACH ROW EXECUTE FUNCTION public.sourdough_owner_matches();
CREATE TRIGGER sourdough_bakes_owner BEFORE INSERT OR UPDATE ON public.sourdough_bakes
  FOR EACH ROW EXECUTE FUNCTION public.sourdough_owner_matches();
CREATE TRIGGER sourdough_bakes_levain BEFORE INSERT OR UPDATE ON public.sourdough_bakes
  FOR EACH ROW EXECUTE FUNCTION public.sourdough_bake_levain_matches();

CREATE TRIGGER sourdough_starters_updated_at BEFORE UPDATE ON public.sourdough_starters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER sourdough_feedings_updated_at BEFORE UPDATE ON public.sourdough_feedings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER sourdough_readings_updated_at BEFORE UPDATE ON public.sourdough_readings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER sourdough_levains_updated_at BEFORE UPDATE ON public.sourdough_levains
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER sourdough_bakes_updated_at BEFORE UPDATE ON public.sourdough_bakes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- On the household list, and only your own rows.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sourdough_starters','sourdough_feedings','sourdough_readings','sourdough_levains','sourdough_bakes'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "own %s, household members only" ON public.%I FOR ALL TO authenticated USING (auth.uid() = user_id AND public.is_allowed()) WITH CHECK (auth.uid() = user_id AND public.is_allowed())', t, t);
  END LOOP;
END $$;

-- Photos: private bucket, one folder per user.
INSERT INTO storage.buckets (id, name, public) VALUES ('sourdough-photos', 'sourdough-photos', false)
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Junior: upload own sourdough photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sourdough-photos' AND (storage.foldername(name))[1] = auth.uid()::text AND public.is_allowed());
CREATE POLICY "Junior: read own sourdough photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sourdough-photos' AND (storage.foldername(name))[1] = auth.uid()::text AND public.is_allowed());
CREATE POLICY "Junior: delete own sourdough photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'sourdough-photos' AND (storage.foldername(name))[1] = auth.uid()::text AND public.is_allowed());

-- Daily cap on AI calls: 50 a day per person unless ai_limits says otherwise.
CREATE TABLE public.ai_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day     date NOT NULL,
  calls   integer NOT NULL DEFAULT 0 CHECK (calls >= 0),
  PRIMARY KEY (user_id, day)
);
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai usage select" ON public.ai_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.ai_limits (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_limit integer NOT NULL CHECK (daily_limit >= 0)
);
ALTER TABLE public.ai_limits ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.claim_ai_use()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  _uid   uuid := auth.uid();
  _day   date := (now() AT TIME ZONE 'utc')::date;
  _limit integer;
  _calls integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_allowed() THEN RETURN false; END IF;
  SELECT l.daily_limit INTO _limit FROM public.ai_limits l WHERE l.user_id = _uid;
  _limit := coalesce(_limit, 50);
  IF _limit <= 0 THEN RETURN false; END IF;
  INSERT INTO public.ai_usage AS u (user_id, day, calls) VALUES (_uid, _day, 1)
  ON CONFLICT (user_id, day) DO UPDATE SET calls = u.calls + 1 WHERE u.calls < _limit
  RETURNING u.calls INTO _calls;
  RETURN _calls IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.claim_ai_use() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_ai_use() TO authenticated;

CREATE FUNCTION public.refund_ai_use()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.ai_usage SET calls = calls - 1
   WHERE user_id = auth.uid() AND day = (now() AT TIME ZONE 'utc')::date AND calls > 0;
$$;
REVOKE ALL ON FUNCTION public.refund_ai_use() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_ai_use() TO authenticated;
