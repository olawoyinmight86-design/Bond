-- ============ Daily Prompts ============
CREATE TABLE IF NOT EXISTS daily_prompts_bank (
  id serial PRIMARY KEY,
  question text NOT NULL UNIQUE
);

INSERT INTO daily_prompts_bank (question) VALUES
  ('What''s a small thing I did recently that made you smile?'),
  ('If we could teleport anywhere for dinner tonight, where would you pick?'),
  ('What''s one thing you''re grateful for about us this week?'),
  ('What''s a memory of us you find yourself thinking about often?'),
  ('What''s something new you''d like us to try together?'),
  ('What made you laugh the hardest recently?'),
  ('What''s your favorite way for me to show I care?'),
  ('If we had a free day with no responsibilities, what would we do?'),
  ('What''s a song that reminds you of us?'),
  ('What''s something you''re proud of yourself for lately?'),
  ('What''s one thing about our relationship you''d never want to change?'),
  ('What''s a dream or goal you''ve been thinking about?'),
  ('What''s your favorite photo of us and why?'),
  ('What''s something small I do that you don''t think I notice you noticing?'),
  ('If we wrote a book about us, what would this chapter be called?'),
  ('What''s a place you''d love for us to visit someday?'),
  ('What''s something you appreciate about how I handled a tough moment?'),
  ('What''s your favorite inside joke between us?'),
  ('What''s one way I could support you better this week?'),
  ('What''s something that made today better, even a little?')
ON CONFLICT (question) DO NOTHING;

CREATE TABLE IF NOT EXISTS daily_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prompt_date date NOT NULL,
  question text NOT NULL,
  user_a_answer text,
  user_b_answer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_a, user_b, prompt_date)
);

ALTER TABLE daily_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read own pair daily answers" ON daily_answers;
CREATE POLICY "read own pair daily answers"
ON daily_answers FOR SELECT TO authenticated
USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE OR REPLACE FUNCTION public.submit_daily_answer(answer_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  partner uuid;
  a uuid; b uuid;
  today date := CURRENT_DATE;
  bank_size int;
  q text;
BEGIN
  SELECT paired_with INTO partner FROM profiles WHERE id = caller;
  IF partner IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not paired'); END IF;

  a := LEAST(caller, partner);
  b := GREATEST(caller, partner);

  SELECT count(*) INTO bank_size FROM daily_prompts_bank;
  SELECT question INTO q FROM daily_prompts_bank
    ORDER BY id OFFSET (EXTRACT(doy FROM today)::int % bank_size) LIMIT 1;

  INSERT INTO daily_answers (user_a, user_b, prompt_date, question, user_a_answer, user_b_answer)
  VALUES (a, b, today, q, CASE WHEN caller = a THEN answer_text END, CASE WHEN caller = b THEN answer_text END)
  ON CONFLICT (user_a, user_b, prompt_date) DO UPDATE SET
    user_a_answer = CASE WHEN caller = a THEN answer_text ELSE daily_answers.user_a_answer END,
    user_b_answer = CASE WHEN caller = b THEN answer_text ELSE daily_answers.user_b_answer END;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_daily_answer(text) TO authenticated;

INSERT INTO daily_prompts_bank (question) VALUES
  ('How are you feeling today, really?'),
  ('What made you smile today?'),
  ('What do you miss right now?'),
  ('What are you grateful for today?')
ON CONFLICT (question) DO NOTHING;

-- Let submitting a daily answer optionally log a mood too, so journaling
-- and mood tracking are the same one motion instead of two separate flows.
CREATE OR REPLACE FUNCTION public.submit_daily_answer(answer_text text, mood_emoji text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  partner uuid;
  a uuid; b uuid;
  today date := CURRENT_DATE;
  bank_size int;
  q text;
BEGIN
  SELECT paired_with INTO partner FROM profiles WHERE id = caller;
  IF partner IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not paired'); END IF;

  a := LEAST(caller, partner);
  b := GREATEST(caller, partner);

  SELECT count(*) INTO bank_size FROM daily_prompts_bank;
  SELECT question INTO q FROM daily_prompts_bank
    ORDER BY id OFFSET (EXTRACT(doy FROM today)::int % bank_size) LIMIT 1;

  INSERT INTO daily_answers (user_a, user_b, prompt_date, question, user_a_answer, user_b_answer)
  VALUES (a, b, today, q, CASE WHEN caller = a THEN answer_text END, CASE WHEN caller = b THEN answer_text END)
  ON CONFLICT (user_a, user_b, prompt_date) DO UPDATE SET
    user_a_answer = CASE WHEN caller = a THEN answer_text ELSE daily_answers.user_a_answer END,
    user_b_answer = CASE WHEN caller = b THEN answer_text ELSE daily_answers.user_b_answer END;

  IF mood_emoji IS NOT NULL THEN
    INSERT INTO timeline (user_id, pair_id, type, content, mood)
    VALUES (caller, partner, 'mood', 'Feeling ' || mood_emoji, mood_emoji);
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_daily_answer(text, text) TO authenticated;

-- Personal journaling streak: consecutive days YOU answered the daily
-- question, independent of whether your partner did too.
CREATE OR REPLACE FUNCTION public.get_journal_streak()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  partner uuid;
  a uuid; b uuid;
  streak int := 0;
  d date := CURRENT_DATE;
  answered boolean;
BEGIN
  SELECT paired_with INTO partner FROM profiles WHERE id = caller;
  IF partner IS NULL THEN RETURN 0; END IF;
  a := LEAST(caller, partner); b := GREATEST(caller, partner);

  SELECT EXISTS(
    SELECT 1 FROM daily_answers WHERE user_a = a AND user_b = b AND prompt_date = d
    AND ((caller = a AND user_a_answer IS NOT NULL) OR (caller = b AND user_b_answer IS NOT NULL))
  ) INTO answered;
  IF NOT answered THEN d := d - 1; END IF;

  LOOP
    SELECT EXISTS(
      SELECT 1 FROM daily_answers WHERE user_a = a AND user_b = b AND prompt_date = d
      AND ((caller = a AND user_a_answer IS NOT NULL) OR (caller = b AND user_b_answer IS NOT NULL))
    ) INTO answered;
    EXIT WHEN NOT answered;
    streak := streak + 1;
    d := d - 1;
  END LOOP;

  RETURN streak;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_journal_streak() TO authenticated;
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bank_size int;
  q text;
BEGIN
  SELECT count(*) INTO bank_size FROM daily_prompts_bank;
  SELECT question INTO q FROM daily_prompts_bank
    ORDER BY id OFFSET (EXTRACT(doy FROM CURRENT_DATE)::int % bank_size) LIMIT 1;
  RETURN jsonb_build_object('question', q);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_todays_prompt() TO authenticated;

-- ============ Games: Truth or Dare + This or That ============
CREATE TABLE IF NOT EXISTS game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_type text NOT NULL,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_a, user_b, game_type)
);

ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read own game sessions" ON game_sessions;
CREATE POLICY "read own game sessions"
ON game_sessions FOR SELECT TO authenticated
USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE OR REPLACE FUNCTION public.td_spin(choice text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  partner uuid;
  a uuid; b uuid;
  cur_state jsonb;
  cur_turn uuid;
  prompt text;
  truths text[] := ARRAY[
    'What''s a habit of mine you secretly love?',
    'What''s the most embarrassing thing you''ve done to impress me?',
    'What''s one thing you''d change about our first date?',
    'What''s a fear you''ve never told me about?',
    'What''s the last thing that made you cry (happy or sad)?',
    'What''s a guilty pleasure you''ve been hiding from me?',
    'What''s something you find attractive that you''ve never mentioned?',
    'What''s the pettiest thing you''ve ever been annoyed at me for?',
    'What''s one thing on your bucket list you haven''t told me?',
    'Who do you talk to most about our relationship?'
  ];
  dares text[] := ARRAY[
    'Send a voice note singing our song (or any song, badly).',
    'Text me a compliment using only emojis.',
    'Send the most recent photo in your camera roll, no explanation.',
    'Do your best impression of me in a voice note.',
    'Write me a 3-line poem right now.',
    'Send a selfie making the weirdest face you can.',
    'Tell me your most-used emoji and why.',
    'Record yourself saying three things you love about me.',
    'Send me a photo of whatever is closest to your right hand right now.',
    'Draw me something with your non-dominant hand and send it.'
  ];
BEGIN
  SELECT paired_with INTO partner FROM profiles WHERE id = caller;
  IF partner IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not paired'); END IF;
  a := LEAST(caller, partner); b := GREATEST(caller, partner);

  SELECT state INTO cur_state FROM game_sessions WHERE user_a = a AND user_b = b AND game_type = 'truth_or_dare';
  cur_turn := (cur_state ->> 'turn')::uuid;

  IF cur_turn IS NOT NULL AND cur_turn != caller THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not your turn');
  END IF;

  IF choice = 'truth' THEN
    prompt := truths[1 + floor(random() * array_length(truths, 1))::int];
  ELSE
    prompt := dares[1 + floor(random() * array_length(dares, 1))::int];
  END IF;

  cur_state := jsonb_build_object('turn', caller, 'promptType', choice, 'prompt', prompt, 'mode', 'prompted', 'penalty', cur_state -> 'penalty');

  INSERT INTO game_sessions (user_a, user_b, game_type, state, updated_at)
  VALUES (a, b, 'truth_or_dare', cur_state, now())
  ON CONFLICT (user_a, user_b, game_type) DO UPDATE SET state = cur_state, updated_at = now();

  RETURN jsonb_build_object('success', true, 'state', cur_state);
END;
$$;
GRANT EXECUTE ON FUNCTION public.td_spin(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.td_resolve(result text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  partner uuid;
  a uuid; b uuid;
  cur_state jsonb;
  new_state jsonb;
  penalties text[] := ARRAY[
    'No phone for the next 20 minutes.',
    'Send your partner a playlist of 3 songs that describe your mood right now.',
    'Do 10 jumping jacks and send proof.',
    'Compliment your partner 3 times in a row, right now.',
    'Let your partner pick your profile picture for the day.',
    'Write "I owe you one" and send a voice note admitting it.',
    'Send your partner a photo from a year ago today (or closest one).',
    'Talk in an accent for your next 3 messages.'
  ];
BEGIN
  SELECT paired_with INTO partner FROM profiles WHERE id = caller;
  IF partner IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not paired'); END IF;
  a := LEAST(caller, partner); b := GREATEST(caller, partner);

  SELECT state INTO cur_state FROM game_sessions WHERE user_a = a AND user_b = b AND game_type = 'truth_or_dare';
  IF cur_state IS NULL OR (cur_state ->> 'turn')::uuid != caller THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nothing to resolve');
  END IF;

  IF result = 'skipped' THEN
    new_state := jsonb_build_object(
      'turn', partner, 'promptType', null, 'prompt', null, 'mode', 'idle',
      'penalty', penalties[1 + floor(random() * array_length(penalties, 1))::int]
    );
  ELSE
    new_state := jsonb_build_object('turn', partner, 'promptType', null, 'prompt', null, 'mode', 'idle', 'penalty', null);
  END IF;

  UPDATE game_sessions SET state = new_state, updated_at = now()
  WHERE user_a = a AND user_b = b AND game_type = 'truth_or_dare';

  RETURN jsonb_build_object('success', true, 'state', new_state);
END;
$$;
GRANT EXECUTE ON FUNCTION public.td_resolve(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.tot_new_round()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  partner uuid;
  a uuid; b uuid;
  pairs text[][] := ARRAY[
    ARRAY['Lazy Sunday in', 'Spontaneous day trip'],
    ARRAY['Movie night', 'Game night'],
    ARRAY['Beach vacation', 'Mountain cabin'],
    ARRAY['Cook together', 'Order in'],
    ARRAY['Morning person', 'Night owl'],
    ARRAY['Text all day', 'One long call'],
    ARRAY['Surprise gifts', 'Planned gifts'],
    ARRAY['Big group hangouts', 'Just us two'],
    ARRAY['Dogs', 'Cats'],
    ARRAY['Sweet breakfast', 'Savory breakfast'],
    ARRAY['Road trip', 'Flight to somewhere new'],
    ARRAY['Slow dancing', 'Dance party']
  ];
  chosen text[];
  new_state jsonb;
BEGIN
  SELECT paired_with INTO partner FROM profiles WHERE id = caller;
  IF partner IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not paired'); END IF;
  a := LEAST(caller, partner); b := GREATEST(caller, partner);

  chosen := pairs[1 + floor(random() * array_length(pairs, 1))::int];
  new_state := jsonb_build_object('optionA', chosen[1], 'optionB', chosen[2], 'picks', '{}'::jsonb);

  INSERT INTO game_sessions (user_a, user_b, game_type, state, updated_at)
  VALUES (a, b, 'this_or_that', new_state, now())
  ON CONFLICT (user_a, user_b, game_type) DO UPDATE SET state = new_state, updated_at = now();

  RETURN jsonb_build_object('success', true, 'state', new_state);
END;
$$;
GRANT EXECUTE ON FUNCTION public.tot_new_round() TO authenticated;

CREATE OR REPLACE FUNCTION public.tot_pick(choice text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  partner uuid;
  a uuid; b uuid;
  cur_state jsonb;
BEGIN
  SELECT paired_with INTO partner FROM profiles WHERE id = caller;
  IF partner IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not paired'); END IF;
  a := LEAST(caller, partner); b := GREATEST(caller, partner);

  SELECT state INTO cur_state FROM game_sessions WHERE user_a = a AND user_b = b AND game_type = 'this_or_that';
  IF cur_state IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'No round in progress'); END IF;

  cur_state := jsonb_set(cur_state, ARRAY['picks', caller::text], to_jsonb(choice));

  UPDATE game_sessions SET state = cur_state, updated_at = now()
  WHERE user_a = a AND user_b = b AND game_type = 'this_or_that';

  RETURN jsonb_build_object('success', true, 'state', cur_state);
END;
$$;
GRANT EXECUTE ON FUNCTION public.tot_pick(text) TO authenticated;

-- ============ Important Dates / Anniversary reminders ============
CREATE TABLE IF NOT EXISTS important_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  event_date date NOT NULL,
  recurring_yearly boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE important_dates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read pair dates" ON important_dates;
CREATE POLICY "read pair dates"
ON important_dates FOR SELECT TO authenticated
USING (auth.uid() = user_a OR auth.uid() = user_b);

DROP POLICY IF EXISTS "delete own dates" ON important_dates;
CREATE POLICY "delete own dates"
ON important_dates FOR DELETE TO authenticated
USING (created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.add_important_date(p_title text, p_event_date date, p_recurring boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  partner uuid;
BEGIN
  SELECT paired_with INTO partner FROM profiles WHERE id = caller;
  IF partner IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not paired'); END IF;

  INSERT INTO important_dates (user_a, user_b, title, event_date, recurring_yearly, created_by)
  VALUES (LEAST(caller, partner), GREATEST(caller, partner), p_title, p_event_date, p_recurring, caller);

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.add_important_date(text, date, boolean) TO authenticated;
