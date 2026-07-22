-- ============ Duo Photo (combined couple photo, async capture-and-merge) ============
-- Note: true live-synchronized dual camera would need a WebRTC signaling/TURN
-- server. This is the honest, reliable version: each partner captures their
-- own shot (whenever they're ready), the app merges both into one image
-- client-side once both are in.
CREATE TABLE IF NOT EXISTS duo_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  photo_a_path text,
  photo_b_path text,
  layout text NOT NULL DEFAULT 'side_by_side',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_a, user_b)
);

ALTER TABLE duo_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read own duo session" ON duo_photos;
CREATE POLICY "read own duo session"
ON duo_photos FOR SELECT TO authenticated
USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE OR REPLACE FUNCTION public.start_duo_photo(p_layout text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  partner uuid;
  a uuid; b uuid;
BEGIN
  SELECT paired_with INTO partner FROM profiles WHERE id = caller;
  IF partner IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not paired'); END IF;
  a := LEAST(caller, partner); b := GREATEST(caller, partner);

  INSERT INTO duo_photos (user_a, user_b, layout, photo_a_path, photo_b_path, updated_at)
  VALUES (a, b, p_layout, NULL, NULL, now())
  ON CONFLICT (user_a, user_b) DO UPDATE SET layout = p_layout, photo_a_path = NULL, photo_b_path = NULL, updated_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.start_duo_photo(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_duo_photo(p_path text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  partner uuid;
  a uuid; b uuid;
BEGIN
  SELECT paired_with INTO partner FROM profiles WHERE id = caller;
  IF partner IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not paired'); END IF;
  a := LEAST(caller, partner); b := GREATEST(caller, partner);

  IF NOT EXISTS (SELECT 1 FROM duo_photos WHERE user_a = a AND user_b = b) THEN
    INSERT INTO duo_photos (user_a, user_b) VALUES (a, b);
  END IF;

  IF caller = a THEN
    UPDATE duo_photos SET photo_a_path = p_path, updated_at = now() WHERE user_a = a AND user_b = b;
  ELSE
    UPDATE duo_photos SET photo_b_path = p_path, updated_at = now() WHERE user_a = a AND user_b = b;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_duo_photo(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reset_duo_photo()
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
  DELETE FROM duo_photos WHERE user_a = LEAST(caller, partner) AND user_b = GREATEST(caller, partner);
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.reset_duo_photo() TO authenticated;
