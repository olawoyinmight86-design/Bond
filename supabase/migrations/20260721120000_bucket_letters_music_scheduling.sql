-- ============ Shared Bucket List ============
CREATE TABLE IF NOT EXISTS bucket_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  added_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bucket_list_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read pair bucket items" ON bucket_list_items;
CREATE POLICY "read pair bucket items" ON bucket_list_items FOR SELECT TO authenticated
USING (auth.uid() = user_a OR auth.uid() = user_b);
DROP POLICY IF EXISTS "update pair bucket items" ON bucket_list_items;
CREATE POLICY "update pair bucket items" ON bucket_list_items FOR UPDATE TO authenticated
USING (auth.uid() = user_a OR auth.uid() = user_b) WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);
DROP POLICY IF EXISTS "delete pair bucket items" ON bucket_list_items;
CREATE POLICY "delete pair bucket items" ON bucket_list_items FOR DELETE TO authenticated
USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE OR REPLACE FUNCTION public.add_bucket_item(p_title text, p_category text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid(); partner uuid;
BEGIN
  SELECT paired_with INTO partner FROM profiles WHERE id = caller;
  IF partner IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not paired'); END IF;
  INSERT INTO bucket_list_items (user_a, user_b, title, category, added_by)
  VALUES (LEAST(caller, partner), GREATEST(caller, partner), p_title, p_category, caller);
  RETURN jsonb_build_object('success', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.add_bucket_item(text, text) TO authenticated;

-- ============ Love Letters (sealed until delivery time, server-enforced) ============
CREATE TABLE IF NOT EXISTS love_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  body text NOT NULL,
  deliver_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE love_letters ENABLE ROW LEVEL SECURITY;
-- Deliberately no SELECT policy — letters are only ever readable through
-- get_my_letters(), which withholds the body until deliver_at has passed.
-- This means a curious recipient can't peek at a sealed letter's content
-- early via the API, only the UI showing "sealed until <date>".

CREATE OR REPLACE FUNCTION public.send_love_letter(p_title text, p_body text, p_deliver_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid(); partner uuid;
BEGIN
  SELECT paired_with INTO partner FROM profiles WHERE id = caller;
  IF partner IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not paired'); END IF;
  INSERT INTO love_letters (author_id, recipient_id, title, body, deliver_at)
  VALUES (caller, partner, p_title, p_body, COALESCE(p_deliver_at, now()));
  RETURN jsonb_build_object('success', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.send_love_letter(text, text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_letters()
RETURNS TABLE(id uuid, title text, body text, sealed boolean, from_me boolean, deliver_at timestamptz, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    l.id, l.title,
    CASE WHEN l.deliver_at <= now() OR l.author_id = auth.uid() THEN l.body ELSE NULL END,
    (l.deliver_at > now() AND l.author_id != auth.uid()),
    (l.author_id = auth.uid()),
    l.deliver_at, l.created_at
  FROM love_letters l
  WHERE l.author_id = auth.uid() OR l.recipient_id = auth.uid()
  ORDER BY l.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_letters() TO authenticated;

-- ============ Now Playing (manual — no external API needed) ============
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS now_playing_title text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS now_playing_artist text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS now_playing_at timestamptz;

-- ============ Scheduled + disappearing messages ============
ALTER TABLE messages ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Recipients shouldn't see a scheduled message before its time, even though
-- it's already written to the DB (this is what makes scheduling work without
-- needing the sender's phone to be online at delivery time — the DB row
-- exists immediately, visibility is what's time-gated).
DROP POLICY IF EXISTS "select_own_messages" ON messages;
CREATE POLICY "select_own_messages"
ON messages FOR SELECT TO authenticated
USING (
  sender_id = auth.uid()
  OR (recipient_id = auth.uid() AND (scheduled_for IS NULL OR scheduled_for <= now()))
);

-- Don't push-notify for a scheduled message the moment it's inserted —
-- only for messages meant to arrive now.
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NEW.scheduled_for IS NOT NULL AND NEW.scheduled_for > now() THEN
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := current_setting('app.send_push_url', true),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)),
    body := jsonb_build_object('recipient_id', NEW.recipient_id, 'sender_id', NEW.sender_id, 'type', NEW.type, 'content', NEW.content, 'media_path', NEW.media_path)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END; $$;

-- Opportunistic cleanup of expired disappearing messages — called by the
-- client whenever the chat is opened, rather than needing a cron job.
CREATE OR REPLACE FUNCTION public.delete_expired_messages()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM messages
  WHERE expires_at IS NOT NULL AND expires_at <= now()
  AND (sender_id = auth.uid() OR recipient_id = auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.delete_expired_messages() TO authenticated;
